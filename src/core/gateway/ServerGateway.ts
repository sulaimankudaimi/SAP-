import type { IDataGateway } from './IDataGateway';
import { isServerMode, getServerUrl, getServerAnonKey } from './connectivity';
import { LocalDexieGateway } from './LocalDexieGateway';
import { SupabaseGateway } from './SupabaseGateway';

export { isServerMode, getServerUrl, getServerAnonKey } from './connectivity';
export const getServerMode = isServerMode;

let gatewayInstance: IDataGateway | null = null;

/**
 * Factory that returns the active data gateway based on VITE_SERVER_MODE.
 * When VITE_SERVER_MODE=false or unset, returns LocalDexieGateway leaving the app 100% offline.
 * When VITE_SERVER_MODE=true, returns SupabaseGateway for the Fleet slice.
 */
export function getGateway(): IDataGateway {
  if (gatewayInstance) {
    return gatewayInstance;
  }

  if (isServerMode()) {
    gatewayInstance = new SupabaseGateway();
  } else {
    gatewayInstance = new LocalDexieGateway();
  }

  return gatewayInstance;
}

/**
 * Reset helper for testing
 */
export function _setGatewayInstanceForTesting(gateway: IDataGateway | null): void {
  gatewayInstance = gateway;
}

export const dataGateway = {
  get instance(): IDataGateway {
    return getGateway();
  },
};
