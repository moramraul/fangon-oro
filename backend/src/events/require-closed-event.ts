import { ConflictException } from '@nestjs/common';
import { EventStatus, EventSummaryStatus } from './schemas/event.schema';

export function requireClosedEvent(event: { status: EventSummaryStatus }) {
  if (event.status !== EventStatus.CLOSED)
    throw new ConflictException(
      'Results are only available after the event closes',
    );
}
