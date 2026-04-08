import { Config } from '@remotion/cli/config'

// Configurações padrão de renderização — funcionam para os 3 vídeos
Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)
Config.setConcurrency(4)
Config.setPixelFormat('yuv420p')   // compatibilidade máxima (Twitter, LinkedIn, YouTube)
Config.setCodec('h264')             // h264 funciona em todo lugar
Config.setCrf(18)                   // qualidade alta (18=visualmente lossless, 23=padrão)
