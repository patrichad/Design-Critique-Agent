import { CritiqueRequest, CritiqueResponse } from "../shared/contracts";

export interface CritiqueApiClientConfig {
  baseUrl: string;
  token: string;
}

export class CritiqueApiClient {
  constructor(private readonly config: CritiqueApiClientConfig) {}

  async createCritique(payload: CritiqueRequest): Promise<CritiqueResponse> {
    const response = await fetch(`${this.config.baseUrl}/v1/critiques`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Critique request failed (${response.status}): ${text}`);
    }

    return (await response.json()) as CritiqueResponse;
  }
}
