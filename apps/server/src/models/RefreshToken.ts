import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // SHA-256 of the raw token. The raw token only ever exists in the user's cookie.
    tokenHash: { type: String, required: true, unique: true },
    // Every token issued from one login shares a family id, so reuse can kill the whole chain.
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    // Hash of the token that replaced this one. null + revokedAt = killed (logout / reuse detected).
    replacedBy: { type: String, default: null },
  },
  { timestamps: true },
);

// TTL index: MongoDB deletes each document once expiresAt has passed (checked about every 60s).
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshTokenAttrs = InferSchemaType<typeof refreshTokenSchema>;
export type RefreshTokenDocument = HydratedDocument<RefreshTokenAttrs>;

export const RefreshToken = model('RefreshToken', refreshTokenSchema);
