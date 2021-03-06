'use strict';

const {
  EyesBase,
  RectangleSize,
  EyesSimpleScreenshot,
  NullRegionProvider,
  CheckSettings,
} = require('@applitools/eyes.sdk.core');

const VERSION = require('../package.json').version;

class EyesStorybook extends EyesBase {
  /**
   * Initializes an Eyes instance.
   *
   * @param {object} [configs] The eyes.storybook configuration
   * @param {PromiseFactory} [promiseFactory] If not specified will be created using `Promise` object
   */
  constructor(configs, promiseFactory) {
    super(undefined, undefined, promiseFactory);

    this.setApiKey(configs.apiKey);
    if (configs.serverUrl) {
      this.setServerUrl(configs.serverUrl);
    }
    if (configs.proxy) {
      this.setProxy(configs.proxy);
    }

    this._title = undefined;
    this._screenshot = undefined;
    this._screenshotUrl = undefined;
    this._inferred = '';
  }

  /** @override */
  getBaseAgentId() {
    return `eyes.storybook/${VERSION}`;
  }

  /**
   * Starts a test.
   *
   * @param {string} appName The application being tested.
   * @param {string} testName The test's name.
   * @param {RectangleSize|{width: number, height: number}} [viewportSize] The client's viewport size (i.e., the
   *   visible part of the document's body) or {@code null} to allow any viewport size.
   * @return {Promise}
   */
  open(appName, testName, viewportSize) {
    const that = this;
    // do not open eyes session, just init Eyes SDK
    return super.openBase(appName, testName).then(() => {
      that._viewportSizeHandler.set(new RectangleSize(viewportSize));
    });
  }

  /**
   * Get a RenderingInfo from eyes server
   *
   * @return {Promise<RenderingInfo>}
   */
  getRenderingInfo() {
    return this._serverConnector.renderInfo();
  }

  /**
   * @param {RenderingInfo} renderingInfo
   */
  setRenderingInfo(renderingInfo) {
    this._serverConnector.setRenderingAuthToken(renderingInfo.getAccessToken());
    this._serverConnector.setRenderingServerUrl(renderingInfo.getServiceUrl());
  }

  /**
   * Create a screenshot of a page on RenderingGrid server
   *
   * @param {RenderRequest} renderRequest
   * @param {RenderingInfo} renderingInfo
   * @return {Promise<string>} The results of the render
   */
  renderWindow(renderRequest, renderingInfo) {
    this.setRenderingInfo(renderingInfo);
    return this._renderWindowTask.renderWindow(renderRequest);
  }

  /**
   * @param {RenderRequest} renderRequest
   * @return {Promise<void>}
   */
  checkAndPutResources(renderRequest) {
    return this._renderWindowTask.checkAndPutResources(renderRequest);
  }

  /**
   * @param {RenderRequest[]} renderRequests
   * @return {Promise<RunningRender[]>}
   */
  postRenderBatch(renderRequests) {
    return this._renderWindowTask.postRenderBatch(renderRequests);
  }

  /**
   * @param {string[]} renderIds
   * @return {Promise<RenderStatusResults[]>}
   */
  getRenderStatusBatch(renderIds) {
    return this._renderWindowTask.getRenderStatusBatch(renderIds);
  }

  /**
   * Perform visual validation for the current image.
   *
   * @param {MutableImage} screenshot The image png bytes or ImageProvider.
   * @param {string} [title] An optional tag to be associated with the validation checkpoint.
   * @return {Promise}
   */
  checkImage(screenshot, title) {
    this._title = title || '';
    this._screenshot = new EyesSimpleScreenshot(screenshot);
    this._screenshotUrl = undefined;

    const regionProvider = new NullRegionProvider(this.getPromiseFactory());
    this._logger.verbose(`checkImage(screenshot, "${title}")`);
    return super.checkSingleWindowBase(regionProvider, title, false, new CheckSettings(0));
  }

  /**
   * @param {string} imageLocation The image URL
   * @param {string} [title] An optional tag to be associated with the validation checkpoint.
   * @return {Promise}
   */
  checkUrl(imageLocation, title) {
    this._title = title || '';
    this._screenshot = undefined;
    this._screenshotUrl = imageLocation;

    const regionProvider = new NullRegionProvider(this.getPromiseFactory());
    this._logger.verbose(`checkUrl(${imageLocation}, "${title}")`);
    return super.checkSingleWindowBase(regionProvider, title, false, new CheckSettings(0));
  }

  /**
   * Ends the currently running test.
   *
   * @param {Boolean} throwEx If true, then the returned promise will 'reject' for failed/aborted tests.
   * @return {Promise} A promise which resolves/rejects (depending on the value of 'throwEx') to the test results.
   */
  close(throwEx = true) { // eslint-disable-line no-unused-vars
    // nothing to close, only single window match requests
    return this.getPromiseFactory().resolve();
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Adds a mouse trigger.
   *
   * @param {MouseTrigger.MouseAction} action  Mouse action.
   * @param {Region} control The control on which the trigger is activated (context relative coordinates).
   * @param {Location} cursor  The cursor's position relative to the control.
   */
  addMouseTrigger(action, control, cursor) {
    super.addMouseTriggerBase(action, control, cursor);
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Adds a keyboard trigger.
   *
   * @param {Region} control The control's context-relative region.
   * @param {string} text The trigger's text.
   */
  addTextTrigger(control, text) {
    super.addTextTriggerBase(control, text);
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Get the AUT session id.
   *
   * @return {Promise<?string>}
   */
  getAUTSessionId() {
    return this.getPromiseFactory().resolve(undefined);
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Get the viewport size.
   *
   * @return {Promise<RectangleSize>}
   */
  getViewportSize() {
    if (this._screenshot) {
      return this.getPromiseFactory().resolve(this._screenshot.getSize());
    }

    return this.getPromiseFactory().resolve(this._viewportSizeHandler.get());
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Set the viewport size.
   *
   * @param {RectangleSize} viewportSize The required viewport size.
   * @return {Promise<void>}
   */
  setViewportSize(viewportSize) {
    this._viewportSizeHandler.set(new RectangleSize(viewportSize));
    return this.getPromiseFactory().resolve();
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Get the inferred environment.
   *
   * @protected
   * @return {Promise<string>} A promise which resolves to the inferred environment string.
   */
  getInferredEnvironment() {
    return this.getPromiseFactory().resolve(this._inferred);
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Sets the inferred environment for the test.
   *
   * @param {string} inferred The inferred environment string.
   */
  setInferredEnvironment(inferred) {
    this._inferred = inferred;
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Get the screenshot.
   *
   * @return {Promise<EyesSimpleScreenshot>} The screenshot.
   */
  getScreenshot() {
    return this.getPromiseFactory().resolve(this._screenshot);
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Get the screenshot URL.
   *
   * @return {Promise<string>} The screenshot URL.
   */
  getScreenshotUrl() {
    return this.getPromiseFactory().resolve(this._screenshotUrl);
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Get the title.
   *
   * @protected
   * @return {Promise<string>} The current title of of the AUT.
   */
  getTitle() {
    return this.getPromiseFactory().resolve(this._title);
  }
}

exports.EyesStorybook = EyesStorybook;
