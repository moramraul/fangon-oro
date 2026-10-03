import { model, Types } from 'mongoose';
import { VoteSchema } from './vote.schema';

describe('Vote schema', () => {
  const VoteModel = model('VoteValidationTest', VoteSchema);
  const ids = Array.from({ length: 3 }, () => new Types.ObjectId());
  const allocations = ids.map((votedUserId, index) => ({
    votedUserId,
    points: [5, 3, 1][index],
  }));
  const ballot = (entries: unknown) =>
    new VoteModel({
      eventId: new Types.ObjectId(),
      voterId: new Types.ObjectId(),
      allocations: entries,
    });

  it('accepts the full ordered allocation', async () => {
    await expect(ballot(allocations).validate()).resolves.toBeUndefined();
  });

  it.each([
    [],
    allocations.slice(0, 2),
    allocations.map((entry) => ({ ...entry, points: 5 })),
    allocations.map((entry) => ({ ...entry, votedUserId: ids[0] })),
    [{ ...allocations[0], points: 9 }, ...allocations.slice(1)],
    undefined,
  ])('rejects incomplete or invalid allocations %p', async (entries) => {
    await expect(ballot(entries).validate()).rejects.toThrow();
  });
});
