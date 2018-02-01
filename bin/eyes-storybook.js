#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');

const {Logger, ConsoleLogHandler, PromiseFactory} = require('eyes.sdk');

const defaultConfigs = require('../src/DefaultConfigs');
const StorybookUtils = require('../src/StorybookUtils');

const VERSION = require('../package.json').version;
const DEFAULT_CONFIG_PATH = 'applitools.config.js';


/* --- Create CLI --- */
let yargs = require('yargs')
    .usage('Usage: $0 --conf applitools.config.js')
    .epilogue('Check our documentation here: https://applitools.com/resources/tutorial')
    .showHelpOnFail(false, 'Specify --help for available options')
    .help()
    .alias('help', 'h')
    .options({
        version: {
            alias: 'v',
            description: 'Show version number',
            requiresArg: false,
            boolean: true
        },
        conf: {
            alias: 'c',
            description: 'Path to Configuration File',
            requiresArg: true,
            default: DEFAULT_CONFIG_PATH
        },
        debug: {
            alias: 'd',
            description: 'Debug mode',
            requiresArg: false,
            boolean: true
        }
    })
    .argv;
if (yargs.help) {
    yargs.showHelp();
}
if (yargs.version) {
    process.stdout.write(`Version ${VERSION}\n`);
    process.exit(1);
}


/* --- Load configuration from config file --- */
let configs;
const configsPath = path.resolve(process.cwd(), yargs.conf);
if (fs.existsSync(configsPath)) {
    console.log('Loading configuration from "' + configsPath + '"...');
    configs = Object.assign(defaultConfigs, require(configsPath));
} else if (yargs.conf !== DEFAULT_CONFIG_PATH) {
    throw new Error('Config file cannot be found in "' + configsPath + '".');
} else {
    configs = defaultConfigs;
}
if (yargs.debug) {
    configs.showLogs = 'verbose';
    configs.showEyesSdkLogs = 'verbose';
    configs.showStorybookOutput = true;
}


/* --- Init common interfaces --- */
const promiseFactory = new PromiseFactory(asyncAction => new Promise(asyncAction));
const logger = new Logger();
if (configs.showLogs) {
    logger.setLogHandler(new ConsoleLogHandler(configs.showLogs === 'verbose'));
}


/* --- Validating configuration --- */
if (!configs.apiKey) {
    throw new Error('The Applitools API Key is missing. Please add it to your configuration file or set ENV key.');
}
if (!configs.maxRunningBrowsers && configs.maxRunningBrowsers !== 0) {
    throw new Error("maxRunningBrowsers should be defined.");
}
if (configs.storybookApp && !['react', 'vue'].includes(configs.storybookApp)) {
    throw new Error('storybookApp should be "react" or "vue".');
}
if (configs.storybookVersion && ![2, 3].includes(configs.storybookVersion)) {
    throw new Error('storybookVersion should be 2 or 3.');
}
if (configs.storybookAddress) {
    if (!configs.storybookAddress.endsWith('/')) {
        configs.storybookAddress = configs.storybookAddress + '/';
    }
}
if (configs.viewportSize) {
    if (!Array.isArray(configs.viewportSize)) {
        configs.viewportSize = [configs.viewportSize];
    }
    for (let i = 0, l = configs.viewportSize.length; i < l; ++i) {
        if (!configs.viewportSize[i].width || !configs.viewportSize[i].height) {
            throw new Error("ViewportSize object should contains width and height properties.");
        }
    }
}


/* --- Parsing package.json, retrieving appName, storybookApp and storybookVersion --- */
const packageJsonPath = process.cwd() + '/package.json';
if (!fs.existsSync(packageJsonPath)) {
    throw new Error('package.json not found on path: ' + packageJsonPath);
}
const packageJson = require(packageJsonPath);
const packageVersion = StorybookUtils.retrieveStorybookVersion(packageJson);
if (!configs.appName) configs.appName = packageJson.name;
if (!configs.storybookApp) configs.storybookApp = packageVersion.app;
if (!configs.storybookVersion) configs.storybookVersion = packageVersion.version;


/* --- Main execution flow --- */
let promise = promiseFactory.resolve();
if (configs.useRenderer) {
    /* --- Building Storybook and make screenshots remote using RenderingGrid --- */
    promise = promise.then(() => {
        return StorybookUtils.buildStorybook(logger, promiseFactory, configs);
    }).then(() => {
        return StorybookUtils.getStoriesFromStatic(logger, promiseFactory, configs)
    }).then(stories => {
        const EyesRenderingRunner = require('../src/EyesRenderingRunner');
        const runner = new EyesRenderingRunner(logger, promiseFactory, configs);
        return runner.testStories(stories);
    });
} else {
    /* --- Starting Storybook and make screenshots locally using WebDriver --- */
    promise = promise.then(() => {
        return StorybookUtils.startServer(logger, promiseFactory, configs);
    }).then(storybookAddress => {
        configs.storybookAddress = storybookAddress;
        return StorybookUtils.getStoriesFromWeb(logger, promiseFactory, configs);
    }).then(stories => {
        const EyesWebDriverRunner = require('../src/EyesWebDriverRunner');
        const runner = new EyesWebDriverRunner(logger, promiseFactory, configs);
        return runner.testStories(stories);
    });
}


/* --- Prepare and display results --- */
return promise.then(/** TestResults[] */ results => {
    if (results.length > 0) {
        console.log('\n');
        console.log('[EYES: TEST RESULTS]:');
        results.forEach(result => {
            const storyTitle = `${result.getName()} [${result.getHostDisplaySize().width}x${result.getHostDisplaySize().height}] - `;

            if (result.getIsNew()) {
                console.log(storyTitle, colors.green("New"));
            } else if (result.isPassed()) {
                console.log(storyTitle, colors.green("Passed"));
            } else {
                console.log(storyTitle, colors.red(`Failed ${result.getMismatches() + result.getMissing()} of ${result.getSteps()}`));
            }
        });
        console.log("See details at", results[0].getAppUrls().batch);
    } else {
        console.log("Test is finished but no results returned.");
    }

    process.exit();
}).catch(function(err) {
    console.error(err.message || err.toString());
    if (yargs.debug) {
        console.error('DEBUG:', err.stack);
    } else {
        console.log('Run with --debug flag to see more logs.');
    }

    process.exit(1);
});
