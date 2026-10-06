import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PersonClient {
  constructor(private readonly config: ConfigService) {}

  async markProfileCompleted(personId: string): Promise<void> {
    const baseUrl = this.config.get<string>('PERSON_API_URL') ?? 'http://localhost:3001/api/v1';
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/persons/${personId}/profile-completed`, {
        method: 'PATCH',
      });
    } catch {
      throw new BadGatewayException('Person API is unavailable');
    }
    if (!response.ok) throw new BadGatewayException('Person API rejected completion');
  }
}
