import {Configuration, Ident, Plugin, SettingsType, Hooks} from '@yarnpkg/core';
import {Hooks as NpmHooks} from '@yarnpkg/plugin-npm'
import {exec} from 'child_process';
import {DateTime} from 'luxon';

const azureDevOpsId = '499b84ac-1321-427f-aa17-267ca6975798'

function run(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) return reject(error)
            if (stderr) return reject(new Error(stderr))
            resolve(stdout)
        })
    })
}

const plugin: Plugin<Hooks & NpmHooks> = {
    configuration: {
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
            if(process.env.SYSTEM_ACCESSTOKEN) {
                return Promise.resolve()
            }
            // This checks to see if the user is logged in before installs even start
            return run('az account list').then(() => {});
        },
        getNpmAuthenticationHeader(
            currentHeader: string | undefined,
            registry: string, {configuration, ident,}: {
                configuration: Configuration;
                ident?: Ident;
            }) {

            if (registry.startsWith("https://pkgs.dev.azure.com") || registry.startsWith("http://pkgs.dev.azure.com")) {
                if(process.env.SYSTEM_ACCESSTOKEN) {
                    return Promise.resolve(`Bearer ${process.env.SYSTEM_ACCESSTOKEN}`)
                }
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
            }
            return Promise.resolve(null);
        },
    }
};

export default plugin;
