# yarn-plugin-az-cli-auth

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
