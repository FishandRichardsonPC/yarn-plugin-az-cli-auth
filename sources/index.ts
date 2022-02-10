import {Configuration, Ident, Plugin, SettingsType, Hooks} from '@yarnpkg/core';
import {Hooks as NpmHooks} from '@yarnpkg/plugin-npm'
import {exec} from 'child_process';
import {DateTime} from 'luxon';

const azureDevOpsId = '499b84ac-1321-427f-aa17-267ca6975798'

function pidIsRunning(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (e) {
		return false;
	}
}

let holdingMutex = false;

// Note: There is a small race condition in this related to multiple processes running simultaneously. The odds of it happening are so low I'm not worrying about it
function waitMutex<T>(inner: () => Promise<T>, configuration: Configuration): Promise<T> {
	const pid = configuration.get("azCliTokenMutex");
	if (holdingMutex || (pid && pidIsRunning(pid))) {
		// Randomly between 75 and 125 ms, this is used to avoid deadlocks, so it doesn't need to be crypto secure
		return new Promise((resolve) => setTimeout(
			resolve,
			75 + Math.floor(Math.random() * 50)
		))
			.then(() => waitMutex(inner, configuration))
	}
	holdingMutex = true;
	return Configuration.updateHomeConfiguration({
		azCliTokenMutex: process.pid
	}).then(inner).then(
		(v) => {
			holdingMutex = false;
			return Configuration.updateHomeConfiguration({
				azCliTokenMutex: undefined
			}).then(() => v);
		},
		(e) => {
			holdingMutex = false;
			return Configuration.updateHomeConfiguration({
				azCliTokenMutex: undefined
			}).then(() => Promise.reject(e), () => Promise.reject(e));
		}
	);
}

function run(cmd: string) {
	return new Promise((resolve, reject) => {
		exec(cmd, (error, stdout, stderr) => {
			if (error) return reject(error)
			if (stderr) return reject(new Error(stderr))
			resolve(stdout)
		})
	});
}

const plugin: Plugin<Hooks & NpmHooks> = {
	configuration: {
		azCliTokenMutex: {
			description: `The pid of a process currently running the azure cli`,
			type: SettingsType.NUMBER
		},
		azCliTokenCache: {
			description: `A cache of tokens fetched via azure cli`,
			type: SettingsType.MAP,
			valueDefinition: {
				description: ``,
				type: SettingsType.SHAPE,
				properties: {
					expiresOn: {
						description: `An ISO timestamp of when the token expires`,
						type: SettingsType.STRING as const
					},
					token: {
						description: `the token`,
						type: SettingsType.STRING as const
					},
				},
			},
		}
	} as any,
	hooks: {
		registerPackageExtensions() {
			const command = process.argv[2] ?? "install";
			// Bypass the login check if not doing things related to downloading packages or we are in CI
			if (['install', 'add', 'update', 'outdated'].indexOf(command) === -1 || process.env.SYSTEM_ACCESSTOKEN) {
				return Promise.resolve()
			}
			// This checks to see if the user is logged in before installs even start
			return run('az account list').then(() => {
			});
		},
		getNpmAuthenticationHeader(
			currentHeader: string | undefined,
			registry: string, {configuration, ident,}: {
				configuration: Configuration;
				ident?: Ident;
			}) {

			if (registry.startsWith("https://pkgs.dev.azure.com") || registry.startsWith("http://pkgs.dev.azure.com")) {
				if (process.env.SYSTEM_ACCESSTOKEN) {
					return Promise.resolve(`Bearer ${process.env.SYSTEM_ACCESSTOKEN}`)
				}
				return waitMutex(
					() => {
						const azCliTokenCache = configuration.get("azCliTokenCache") as {
							[registry: string]: {
								expiresOn: string;
								token: string;
							} | undefined
						}
						const expiresOn = azCliTokenCache[registry]?.expiresOn && DateTime.fromISO(azCliTokenCache[registry].expiresOn)
						if ((expiresOn?.diffNow("seconds").seconds ?? 0) > 0) {
							return Promise.resolve(`Bearer ${azCliTokenCache[registry].token}`)
						}
						return run(`az account get-access-token --resource \"${azureDevOpsId}\"`).then((result: string) => {
							const parsed = JSON.parse(result) as { accessToken: string; expiresOn: string };
							azCliTokenCache[registry] = {
								expiresOn: DateTime.fromSQL(parsed.expiresOn).toISO(),
								token: parsed.accessToken
							}
							return Configuration.updateHomeConfiguration({
								azCliTokenCache
							}).then(() => `Bearer ${azCliTokenCache[registry].token}`);
						})
					},
					configuration
				)
			}
			return Promise.resolve(null);
		},
	}
};

export default plugin;
