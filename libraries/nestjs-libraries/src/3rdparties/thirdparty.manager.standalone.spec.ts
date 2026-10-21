import 'reflect-metadata';
import {
  checkAvailableThirdPartyFunction,
  ExposeThirdPartyFunction,
} from './thirdparty.interface';

// The `/third-party/function/:id/:functionName` endpoint dispatches by a
// URL-supplied method name onto a provider instance. Without an allowlist,
// any authenticated org member could invoke ANY method found on that
// instance (checkConnection, sendData, or a future internal helper) just by
// naming it in the URL - not just the handful of methods the frontend
// actually calls (generateVoice/voices/avatars/listMedia). This mirrors the
// allowlist VideoManager already enforces for its own name-dispatched
// video functions. Tested as the standalone function (not through
// ThirdPartyManager) so this doesn't pull in the real Nest DI chain
// (ThirdPartyService -> ... -> AuthService -> bcrypt's native binding),
// which isn't available in this sandbox - same reasoning as the other
// *.standalone.spec.ts files in this repo.
describe('checkAvailableThirdPartyFunction', () => {
  class FakeProvider {
    @ExposeThirdPartyFunction('an allowed tool')
    exposedMethod() {
      return 'exposed';
    }

    notExposedMethod() {
      return 'should never be reachable from the URL';
    }

    async checkConnection() {
      return false as const;
    }

    async sendData() {
      return 'sent';
    }
  }

  const instance = new FakeProvider();

  it('allows a method explicitly marked with @ExposeThirdPartyFunction', () => {
    expect(
      checkAvailableThirdPartyFunction(instance.exposedMethod)
    ).toBe(false);
  });

  it('rejects a method that exists but was never exposed', () => {
    expect(
      checkAvailableThirdPartyFunction(instance.notExposedMethod)
    ).toBe(true);
  });

  it('rejects checkConnection/sendData - internal lifecycle methods, never meant for URL dispatch', () => {
    expect(
      checkAvailableThirdPartyFunction(instance.checkConnection)
    ).toBe(true);
    expect(
      checkAvailableThirdPartyFunction(instance.sendData)
    ).toBe(true);
  });

  it('rejects an arbitrary inherited/unrelated method such as toString', () => {
    expect(
      checkAvailableThirdPartyFunction(instance.toString)
    ).toBe(true);
  });
});
