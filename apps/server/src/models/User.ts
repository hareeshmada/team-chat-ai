import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select: false → never loaded unless a query explicitly asks for '+passwordHash'.
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      // Safety net: even if a user document is ever sent with res.json(), no hash leaks.
      transform(_doc, ret: Record<string, unknown>) {
        const { _id, __v: _version, passwordHash: _hash, ...rest } = ret;
        return { id: String(_id), ...rest };
      },
    },
  },
);

export type UserAttrs = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserAttrs>;

export const User = model('User', userSchema);
