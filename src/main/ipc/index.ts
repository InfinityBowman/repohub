import { registerRepositoryHandlers } from './repository.handler'
import { registerProcessHandlers } from './process.handler'
import { registerPortHandlers } from './port.handler'
import { registerConfigHandlers } from './config.handler'
import type { RepositoryService } from '../services/RepositoryService'
import type { ProcessService } from '../services/ProcessService'
import type { PortService } from '../services/PortService'
import type { ConfigService } from '../services/ConfigService'

export function registerAllHandlers(services: {
  repositoryService: RepositoryService
  processService: ProcessService
  portService: PortService
  configService: ConfigService
}): void {
  registerRepositoryHandlers(services.repositoryService)
  registerProcessHandlers(services.processService)
  registerPortHandlers(services.portService)
  registerConfigHandlers(services.configService)
}
