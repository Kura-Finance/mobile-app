import type { ResolveSmartAccountClient, TypedDataInput } from './types';

export async function signMessageTx(
  resolveClient: ResolveSmartAccountClient,
  message: string,
): Promise<string> {
  const { smartAccountClient: client } = await resolveClient();
  return (await client.signMessage({ message })) as string;
}

export async function signTypedDataTx(
  resolveClient: ResolveSmartAccountClient,
  typedData: TypedDataInput,
): Promise<string> {
  const { smartAccountClient: client } = await resolveClient();
  return (await client.signTypedData({
    domain: typedData.domain,
    types: typedData.types,
    primaryType: typedData.primaryType,
    message: typedData.message,
  })) as string;
}
