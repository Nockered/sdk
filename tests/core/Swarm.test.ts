import ava, { ExecutionContext, TestFn } from 'ava'
import { NodeAPI } from '../../src/api/NodeAPI.js'
import { SecretAPI } from '../../src/api/SecretAPI.js'
import { Node } from '../../src/core/Node.js'
import { Secret } from '../../src/core/Secret.js'
import { Swarm } from '../../src/core/Swarm.js'
import DockerAPI from '../../src/index.js'
import { TestExecutionContext } from '../../src/types/TestExecutionContext.js'
import { RequestError } from 'got'
import { GetParamType } from '../../src/utils/GetParamType.js'

const test = ava as TestFn<TestExecutionContext>

const createSecret = async (
  name: string,
  body?: GetParamType<'SecretCreate'>['body']['body'],
  t?: ExecutionContext<TestExecutionContext>
) => {
  /**
   * @exception
   * SecretCreate should return Id based on the documentation
   * but returns ID.
   */
  const secret: any = await Secret.create({
    Name: name,
    Data: 'VEhJUyBJUyBBIFRFU1Q=',
    ...body
  })
  t?.teardown(() => Secret.delete({ id: secret.ID }))
  return secret
}

const createSecretWithAPI = async (
  name: string,
  body?: GetParamType<'SecretCreate'>['body']['body'],
  t?: ExecutionContext<TestExecutionContext>
) => {
  /**
   * @exception
   * SecretCreate should return Id based on the documentation
   * but returns ID.
   */
  const secret: any = await SecretAPI.create({
    Name: name,
    Data: 'VEhJUyBJUyBBIFRFU1Q=',
    ...body
  })
  t?.teardown(() => Secret.delete({ id: secret.ID }))
  return secret
}

test.before(async (t) => {
  t.context.DockerAPI = new DockerAPI('unix:/var/run/docker.sock:/v1.41')
  return await Swarm.init({
    ListenAddr: '0.0.0.0:2377'
  })
})

test.after.always(async () => {
  await Swarm.leave({ force: true })
})

test('static inspect()', async (t) => {
  const resp = await Swarm.inspect()
  t.is(typeof resp.ID, 'string')
})

test('static join()', async (t) => {
  await t.throwsAsync(
    async () => {
      await Swarm.join({
        ListenAddr: '0.0.0.0:2377'
      })
    },
    {
      instanceOf: RequestError,
      message: 'Response code 503 (Service Unavailable)'
    }
  )
})

test.serial('static update()', async (t) => {
  const swarm = await Swarm.inspect()
  await Swarm.update(
    { version: swarm.Version.Index, rotateManagerToken: true },
    {}
  )
  const updatedSwarm = await Swarm.inspect()
  t.not(swarm.JoinTokens.Manager, updatedSwarm.JoinTokens.Manager)
})

test.serial('static unlockKey()', async (t) => {
  const swarm = await Swarm.inspect()
  await Swarm.update(
    { version: swarm.Version.Index },
    { EncryptionConfig: { AutoLockManagers: true } }
  )
  const resp = await Swarm.unlockKey()
  t.true(resp.UnlockKey !== '')
})

test.serial('static unlock()', async (t) => {
  const swarm = await Swarm.inspect()
  await Swarm.update(
    { version: swarm.Version.Index, rotateManagerUnlockKey: true },
    { EncryptionConfig: { AutoLockManagers: true } }
  )
  const resp = await Swarm.unlockKey()
  await t.throwsAsync(
    async () => {
      await Swarm.unlock({ UnlockKey: resp.UnlockKey })
    },
    {
      instanceOf: RequestError,
      message: 'Response code 409 (Conflict)'
    }
  )
})

test('static node-list()', async (t) => {
  const resp = await Node.list()
  t.true(Array.isArray(resp))
})

test('static node-inspect()', async (t) => {
  const node = await Node.list()
  if (node[0]) {
    const resp = await Node.inspect({ id: node[0].ID })
    t.is(typeof resp.ID, 'string')
  }
})

test('static node-delete()', async (t) => {
  const node = await Node.list()
  await t.throwsAsync(async () => {
    if (node[0]) {
      await Node.delete({ id: node[0].ID })
    }
  })
})

test.serial('static node-update()', async (t) => {
  const node = await Node.list()
  if (node[0]) {
    await Node.update(
      { id: node[0].ID },
      { version: node[0].Version.Index },
      { Role: 'manager', Availability: 'pause' }
    )
    const resp = await Node.inspect({ id: node[0].ID })
    t.is(resp.Spec.Availability, 'pause')
  }
})

test('static nodeApi-list()', async (t) => {
  const resp = await NodeAPI.list()
  t.true(resp[0] instanceof Node)
})

test('static nodeApi-get()', async (t) => {
  const node = await NodeAPI.list()
  if (node[0]) {
    const resp = await NodeAPI.get(node[0].ID)
    t.is(typeof resp.ID, 'string')
  }
})

test('node-inspect()', async (t) => {
  const node = await NodeAPI.list()
  if (node[0]) {
    const resp = await node[0].inspect()
    t.is(typeof resp.ID, 'string')
  }
})

test('node-delete()', async (t) => {
  const node = await NodeAPI.list()
  await t.throwsAsync(async () => {
    if (node[0]) {
      await node[0].delete()
    }
  })
})

test.serial('node-update()', async (t) => {
  const node = await NodeAPI.list()
  if (node[0] && node[0].Version.Index) {
    await node[0].update(
      { version: node[0].Version.Index },
      { Role: 'manager', Availability: 'pause' }
    )
    const resp = await node[0].inspect()
    t.is(resp.Spec.Availability, 'pause')
  }
})

test('static secret-list()', async (t) => {
  const resp = await Secret.list()
  t.true(Array.isArray(resp))
})

test('static secret-create()', async (t) => {
  const resp = await createSecret('secret-create', undefined, t)
  t.is(typeof resp.ID, 'string')
})

test('static secret-inspect()', async (t) => {
  const resp = await createSecret('secret-inspect', undefined, t)
  const inspect = await Secret.inspect({ id: resp.ID })
  t.is(typeof inspect.ID, 'string')
})

test('static secret-delete()', async (t) => {
  const resp = await createSecret('secret-delete', undefined)
  await Secret.delete({ id: resp.ID })
  const secrets = await Secret.list()
  t.false(secrets.some((s) => s.ID === resp.ID))
})

test('static secretAPI-list()', async (t) => {
  await createSecret('secretAPI-list', undefined, t)
  const resp = await SecretAPI.list()
  t.true(resp[0] instanceof Secret)
})

test('static secretAPI-get()', async (t) => {
  const resp = await createSecret('secretAPI-get', undefined, t)
  const secret = await SecretAPI.get(resp.ID)
  t.is(typeof secret.ID, 'string')
})

test.serial('static secretAPI-create()', async (t) => {
  const resp = await createSecretWithAPI('secretAPI-create', undefined, t)
  t.true(resp instanceof Secret)
})

test.serial('secret-inspect()', async (t) => {
  const resp = await createSecretWithAPI('secretAPI-inspect', undefined, t)
  const inspect = await resp.inspect()
  t.is(typeof inspect.ID, 'string')
})

test.serial('secret-delete()', async (t) => {
  const resp = await createSecretWithAPI('secretAPI-delete', undefined)
  await resp.delete()
  const secrets = await Secret.list()
  t.false(secrets.some((s) => s.ID === resp.ID))
})
