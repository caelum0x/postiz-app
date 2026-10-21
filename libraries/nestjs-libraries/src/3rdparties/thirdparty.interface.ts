import { Injectable } from '@nestjs/common';

export abstract class ThirdPartyAbstract<T = any> {
  abstract checkConnection(
    apiKey: string
  ): Promise<false | { name: string; username: string; id: string }>;
  abstract sendData(apiKey: string, data: T): Promise<string>;
  [key: string]: ((apiKey: string, data?: any) => Promise<any>) | undefined;
}
export interface ThirdPartyParams {
  identifier: string;
  title: string;
  description: string;
  // where a connected integration shows up in the post editor
  position?: 'media' | 'media-library' | 'webhook';
  fields: {
    name: string;
    description: string;
    type: string;
    placeholder: string;
    validation?: RegExp;
  }[];
  // An integration installed on the other platform instead of connected here
  // with an API key: the list opens this link. undefined hides it
  installUrl?: () => string | undefined;
}

// Marks a provider method as safe to invoke by name from the generic
// `/third-party/function/:id/:functionName` dispatch endpoint. Mirrors
// `ExposeVideoFunction` in video.interface.ts - without this allowlist,
// that endpoint would let any authenticated org member invoke ANY method
// found on the provider instance (checkConnection, sendData, or any future
// internal helper) just by naming it in the URL.
export function ExposeThirdPartyFunction(description?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    Reflect.defineMetadata(
      'third-party-function',
      description || 'true',
      descriptor.value
    );
  };
}

// Returns false only for methods explicitly marked with
// @ExposeThirdPartyFunction - same allowlist shape as
// VideoManager#checkAvailableVideoFunction. Callers must treat `true`
// (not found, not a function, or not marked) as "reject the call". Kept as
// a standalone function (not a class method) so it can be unit-tested
// without pulling in ThirdPartyManager's full Nest DI chain.
export function checkAvailableThirdPartyFunction(method: any) {
  const thirdPartyFunction = Reflect.getMetadata(
    'third-party-function',
    method
  );
  return !thirdPartyFunction;
}

export function ThirdParty(params: ThirdPartyParams) {
  return function (target: any) {
    // Apply @Injectable decorator to the target class
    Injectable()(target);

    // Retrieve existing metadata or initialize an empty array
    const existingMetadata =
      Reflect.getMetadata('third:party', ThirdPartyAbstract) || [];

    // Add the metadata information for this method
    existingMetadata.push({ target, ...params });

    // Define metadata on the class prototype (so it can be retrieved from the class)
    Reflect.defineMetadata('third:party', existingMetadata, ThirdPartyAbstract);
  };
}
