import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const requestId = uuidv4();
    const request = context.switchToHttp().getRequest();

    // Skip metrics for health check endpoints to avoid noise
    if (request.url?.startsWith('/health')) {
      return next.handle();
    }

    // Start tracking the request
    this.metricsService.startRequest(requestId);

    return next.handle().pipe(
      tap(() => {
        // Request completed successfully
        this.metricsService.completeRequest(requestId);
      }),
      catchError((error) => {
        // Request failed
        this.metricsService.failRequest(requestId);
        throw error;
      }),
    );
  }
}
