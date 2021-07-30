# yarn-plugin-az-cli-auth
[![Github Downloads](https://img.shields.io/github/downloads/FishandRichardsonPC/yarn-plugin-az-cli-auth/total)]()

Yarn Berry plugin to use the az cli for authentication to azure devops repos

## Installation

### First time setup per machine
1. Install the [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
2. Make sure the az command is part of your path
3. Run az login

### Per project setup
To install the latest release use
```sh
yarn plugin import https://github.com/FishandRichardsonPC/yarn-plugin-az-cli-auth/releases/latest/download/plugin-az-cli-auth.js
```
or to install a specific version use
```sh
yarn plugin import https://github.com/FishandRichardsonPC/yarn-plugin-az-cli-auth/releases/download/X.Y.Z/plugin-az-cli-auth.js
```

Then you will need to setup your .yarnrc.yml file to connect with azure devops

Example:
```yaml
npmRegistries:
  //pkgs.dev.azure.com/<organization>/_packaging/<azurefeed>/npm/registry:
    npmAlwaysAuth: true
  //pkgs.dev.azure.com/<organization>/_packaging/<azurefeed>/npm:
    npmAlwaysAuth: true

npmScopes:
  <org>:
    npmRegistryServer: https://pkgs.dev.azure.com/<organization>/_packaging/<azurefeed>/npm/registry
```