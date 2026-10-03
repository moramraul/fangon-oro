import { PipelineStage } from 'mongoose';
// Legacy single-candidate ballots contribute one point.
export function pointsPipeline(): PipelineStage[] {
  return [
    {
      $project: {
        allocations: {
          $ifNull: [
            '$allocations',
            [{ votedUserId: '$votedUserId', points: 1 }],
          ],
        },
      },
    },
    { $unwind: '$allocations' },
    {
      $group: {
        _id: '$allocations.votedUserId',
        points: { $sum: '$allocations.points' },
        fivePointVotes: {
          $sum: { $cond: [{ $eq: ['$allocations.points', 5] }, 1, 0] },
        },
        threePointVotes: {
          $sum: { $cond: [{ $eq: ['$allocations.points', 3] }, 1, 0] },
        },
      },
    },
  ];
}
