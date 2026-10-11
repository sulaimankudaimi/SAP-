/**
 * ServerGateway Factory
 *
 * Instantiates SupabaseGateway when VITE_SERVER_MODE is true,
 * otherwise returns LocalDexieGateway so the client runs completely locally.
 */

import type { IDataGateway } from './IDataGateway';
import { LocalDexieGateway } from './LocalDexieGateway';
import { SupabaseGateway } from './SupabaseGateway';

let gatewayInstance: IDataGateway | null = null;

export function getServerMode(): boolean {
  return import.meta.env.VITE_SERVER_MODE === 'true';
}

export function getServerUrl(): string {
  return import.meta.env.VITE_ERP_SERVER_URL || '';
}

export function getServerAnonKey(): string {
  return import.meta.env.VITE_ERP_ANON_KEY || '';
}

export function createServerGateway(forceServerMode?: boolean): IDataGateway {
  const isServer = forceServerMode !== undefined ? forceServerMode : getServerMode();

  if (isServer) {
    const url = getServerUrl();
    const key = getServerAnonKey();
    return new SupabaseGateway(url, key);
  }

  return new LocalDexieGateway();
}

export function getServerGateway(): IDataGateway {
  if (!gatewayInstance) {
    gatewayInstance = createServerGateway();
  }
  return gatewayInstance;
}

export function _resetServerGatewayForTesting(mockGateway?: IDataGateway): void {
  gatewayInstance = mockGateway || null;
}
