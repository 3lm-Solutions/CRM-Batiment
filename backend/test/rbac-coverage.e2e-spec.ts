import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../src/common';
import { createTestApp, type TestApp } from './helpers/test-app';

/**
 * P0.7 safety net: walks EVERY controller route of the real app and fails if one has
 * neither @Public() nor a non-empty @Roles(). Such a route would answer 403 to everyone
 * (secure by default) — this test catches the mistake at build time instead of in QA.
 */
describe('RBAC coverage (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  it('every route declares @Public() or @Roles()', () => {
    const discovery = t.app.get(DiscoveryService);
    const scanner = t.app.get(MetadataScanner);
    const reflector = t.app.get(Reflector);

    const missing: string[] = [];
    let routeCount = 0;

    for (const wrapper of discovery.getControllers()) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype) continue;
      const prototype = Object.getPrototypeOf(instance) as object;

      for (const methodName of scanner.getAllMethodNames(prototype)) {
        const handler = (prototype as Record<string, unknown>)[methodName] as object;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
        if (method === undefined) continue; // not a route
        routeCount++;

        const targets = [handler as () => unknown, metatype];
        const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
        const roles = reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, targets);

        if (!isPublic && !roles?.length) {
          const base = String(Reflect.getMetadata(PATH_METADATA, metatype) ?? '');
          const path = String(Reflect.getMetadata(PATH_METADATA, handler) ?? '');
          missing.push(`${RequestMethod[method]} /${base}/${path}  (${metatype.name}.${methodName})`);
        }
      }
    }

    expect(routeCount).toBeGreaterThan(10);
    expect(missing).toEqual([]);
  });
});
