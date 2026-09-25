import type { Model } from 'mongoose';
import mongoose, { model, Schema } from 'mongoose';

interface CounterDoc {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

/** Ceza numarası gibi atomik sayaçları tutan koleksiyon. */
export const Counter: Model<CounterDoc> =
  (mongoose.models.Counter as Model<CounterDoc> | undefined) ??
  model<CounterDoc>('Counter', counterSchema);

/**
 * `name` sayacını atomik olarak bir artırır ve yeni değeri döner. Sayaç yoksa 0'dan
 * oluşturulup 1 ile döner (`findOneAndUpdate` + `$inc`, `upsert`).
 */
export async function nextSequence(name: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  ).lean();

  if (!doc) {
    throw new Error(`Sayaç güncellenemedi: ${name}`);
  }

  return doc.seq;
}
