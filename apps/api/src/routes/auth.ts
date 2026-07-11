import crypto from 'node:crypto';
import bs58 from 'bs58';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import nacl from 'tweetnacl';
import { verifyMessage } from 'viem';
import { z } from 'zod';
import { env } from '../env';
import { asyncHandler } from '../lib/asyncHandler';
import { ApiError } from '../lib/errors';
import { isValidWallet, normalizeWallet } from '../lib/wallet';
import { NonceModel } from '../models/Nonce';
import { UserModel } from '../models/User';
import { getAccount } from '../services/StakingService';

const NONCE_TTL_MS = 5 * 60 * 1000;

/** Exact sign-in message template from the contract — do not reformat. */
function buildSignInMessage(wallet: string, nonce: string): string {
  return `Apogee wants you to sign in with your wallet:\n${wallet}\n\nNonce: ${nonce}`;
}

const walletAndChain = {
  wallet: z.string().min(1),
  chainType: z.enum(['sol', 'evm']),
};

const withWalletCheck = <T extends { wallet: string; chainType: 'sol' | 'evm' }>(
  schema: z.ZodType<T>,
) =>
  schema.superRefine((val, ctx) => {
    if (!isValidWallet(val.wallet, val.chainType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['wallet'],
        message: `Invalid ${val.chainType} wallet address`,
      });
    }
  });

const nonceQuerySchema = withWalletCheck(z.object(walletAndChain));
const verifyBodySchema = withWalletCheck(
  z.object({ ...walletAndChain, signature: z.string().min(1).max(2048) }),
);

async function verifyEvmSignature(
  wallet: string,
  message: string,
  signature: string,
): Promise<boolean> {
  try {
    return await verifyMessage({
      address: wallet as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    return false; // malformed signature bytes
  }
}

function verifySolSignature(wallet: string, message: string, signature: string): boolean {
  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      bs58.decode(signature),
      bs58.decode(wallet),
    );
  } catch {
    return false; // bad base58 / wrong lengths
  }
}

export const authRouter = Router();

/**
 * GET /api/auth/nonce?wallet=&chainType=
 * Issues a single-use 16-byte hex nonce (5 min TTL, upserted per wallet).
 */
authRouter.get(
  '/nonce',
  asyncHandler(async (req, res) => {
    const parsed = nonceQuerySchema.parse(req.query);
    const wallet = normalizeWallet(parsed.wallet, parsed.chainType);

    const nonce = crypto.randomBytes(16).toString('hex');
    await NonceModel.findOneAndUpdate(
      { wallet },
      { $set: { nonce, expiresAt: new Date(Date.now() + NONCE_TTL_MS) } },
      { upsert: true },
    );

    res.json({ nonce, message: buildSignInMessage(wallet, nonce) });
  }),
);

/**
 * POST /api/auth/verify { wallet, chainType, signature }
 * Verifies the signature over the stored nonce's message, consumes the nonce,
 * upserts the User (first-time demo balances), and returns a 2h JWT + account.
 */
authRouter.post(
  '/verify',
  asyncHandler(async (req, res) => {
    const body = verifyBodySchema.parse(req.body);
    const wallet = normalizeWallet(body.wallet, body.chainType);

    const record = await NonceModel.findOne({ wallet });
    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new ApiError(400, 'NONCE_EXPIRED', 'Nonce missing or expired — request a new one');
    }

    const message = buildSignInMessage(wallet, record.nonce);
    // DEMO_MODE bypasses only the cryptographic check; the nonce must exist.
    const demoBypass = env.DEMO_MODE && body.signature === 'demo';
    if (!demoBypass) {
      const valid =
        body.chainType === 'evm'
          ? await verifyEvmSignature(wallet, message, body.signature)
          : verifySolSignature(wallet, message, body.signature);
      if (!valid) throw new ApiError(401, 'INVALID_SIGNATURE', 'Signature verification failed');
    }

    await NonceModel.deleteOne({ _id: record._id }); // single-use

    // First-time users start with the demo balances (schema defaults).
    const existing = await UserModel.findOne({ wallet });
    if (!existing) {
      await UserModel.create({
        wallet,
        chainType: body.chainType,
        usdcBalance: 25_000,
        apgBalance: 60_000,
      });
    }

    const account = await getAccount(wallet);
    const token = jwt.sign({ wallet, chainType: body.chainType }, env.JWT_SECRET, {
      expiresIn: '2h',
    });

    res.json({ token, account });
  }),
);
