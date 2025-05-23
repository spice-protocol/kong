import { EvmAddress, EvmAddressSchema, zhexstring } from 'lib/types'
import { toEventSelector } from 'viem'
import { z } from 'zod'
import db from '../../../../../db'
import { rpcs } from '../../../../../rpcs'
import roleManagerAbi from '../../roleManager/abi'

export const SnapshotSchema = z.object({
  accountant: EvmAddressSchema.optional(),
  role_manager: EvmAddressSchema.optional()
})

export default async function process(chainId: number, address: `0x${string}`) {
  const projects = await projectProjects(chainId, address)
  return { projects }
}

async function projectProjects(chainId: number, vault: `0x${string}`, blockNumber?: bigint) {
  const topic = toEventSelector('event NewProject(bytes32 indexed projectId, address indexed roleManager)')

  const events = await db.query(`
  SELECT args
  FROM evmlog
  WHERE chain_id = $1 AND address = $2 AND signature = $3 AND (block_number <= $4 OR $4 IS NULL)
  ORDER BY block_number ASC, log_index ASC`,
  [chainId, vault, topic, blockNumber])

  if(events.rows.length === 0) return []

  const result: { projectId: string, roleManager: string, name: string }[] = []

  for (const event of events.rows) {
    result.push({
      projectId: zhexstring.parse(event.args.projectId),
      roleManager: EvmAddressSchema.parse(event.args.roleManager),
      name: await getProjectName(chainId, event.args.roleManager)
    })
  }

  return result
}

async function getProjectName(chainId: number, roleManager: EvmAddress) {
  const roleManagerName = await rpcs.next(chainId).readContract({
    abi: roleManagerAbi, address: roleManager, functionName: 'name'
  })
  return roleManagerName.replace(' Role Manager', '')
}
