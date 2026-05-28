import { Config } from '@remotion/cli/config'

// Conservative defaults for local Windows rendering stability.
Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)
Config.setConcurrency(2)
Config.setPixelFormat('yuv420p')
Config.setCodec('h264')
Config.setCrf(18)
Config.setChromeMode('chrome-for-testing')
Config.setChromiumOpenGlRenderer('angle')
Config.setDelayRenderTimeoutInMilliseconds(120000)
