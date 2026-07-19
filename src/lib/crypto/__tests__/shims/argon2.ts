type Argon2Config = {
  iterations?: number;
  memory?: number;
  parallelism?: number;
  hashLength?: number;
  mode?: string;
};

export default async function argon2(
  password: string,
  salt: string,
  _config: Argon2Config = {},
): Promise<{ rawHash: string; encodedHash: string }> {
  const rawHash = `argon2:${salt}:${password}`;
  return { rawHash, encodedHash: `$argon2id$${rawHash}` };
}
