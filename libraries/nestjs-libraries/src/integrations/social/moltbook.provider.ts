import {
  AuthTokenDetails,
  PostDetails,
  PostResponse,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { makeSecureId } from '@gitroom/nestjs-libraries/services/make.secure.id';
import { SocialAbstract } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { MoltbookDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/moltbook.dto';
import dayjs from 'dayjs';
import { Integration } from '@prisma/client';

const MOLTBOOK_API_BASE = 'https://www.moltbook.com/api/v1';

// AxiosError carries the full request config on `err.config` (and in
// `err.toJSON()`), including the `Authorization: Bearer <apiKey>` header this
// provider sends on every call. Letting that raw error escape (thrown,
// logged, or returned to a caller) leaks the agent's API key wherever it ends
// up - Sentry, activity failure details, or an error response. Every axios
// call in this provider must be caught and converted with this helper before
// it can propagate.
function sanitizeAxiosError(err: any, fallback: string): Error {
  const data = err?.response?.data;
  const message =
    (data && typeof data === 'object' && typeof data.error === 'string'
      ? data.error
      : undefined) ||
    (err?.response?.status
      ? `Moltbook request failed with status ${err.response.status}`
      : undefined) ||
    fallback;

  // A plain Error carries only `message`/`stack` - never the axios config,
  // so there is no Authorization header left for anything downstream to log.
  return new Error(message);
}

export class MoltbookProvider extends SocialAbstract implements SocialProvider {
  override maxConcurrentJob = 100; // Moltbook: 100 requests/minute
  identifier = 'moltbook';
  name = 'Moltbook';
  dto = MoltbookDto;
  isBetweenSteps = false;
  scopes = [] as string[];
  isWeb3 = true;
  editor = 'normal' as const;

  maxLength() {
    return 300;
  }

  async refreshToken(refreshToken: string): Promise<AuthTokenDetails> {
    return {
      refreshToken: '',
      expiresIn: 0,
      accessToken: '',
      id: '',
      name: '',
      picture: '',
      username: '',
    };
  }

  async generateAuthUrl() {
    const state = makeSecureId(6);
    return {
      url: state,
      codeVerifier: makeSecureId(10),
      state,
    };
  }

  async registerAgent(name: string, description: string) {
    let response;
    try {
      response = await this.getSsrfSafeAxios().post(
        `${MOLTBOOK_API_BASE}/agents/register`,
        { name, description },
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err: any) {
      throw sanitizeAxiosError(err, 'Registration failed');
    }

    if (!response.data.success) {
      throw new Error(response.data.error || 'Registration failed');
    }

    return response.data.agent;
  }

  async checkAgentStatus(apiKey: string) {
    try {
      const response = await this.getSsrfSafeAxios().get(
        `${MOLTBOOK_API_BASE}/agents/status`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );

      return response.data;
    } catch (err: any) {
      throw sanitizeAxiosError(err, 'Failed to check agent status');
    }
  }

  async getAgentProfile(apiKey: string) {
    let response;
    try {
      response = await this.getSsrfSafeAxios().get(
        `${MOLTBOOK_API_BASE}/agents/me`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );
    } catch (err: any) {
      throw sanitizeAxiosError(err, 'Failed to get profile');
    }

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get profile');
    }

    return response.data.agent;
  }

  async authenticate(params: {
    code: string;
    codeVerifier: string;
    refresh?: string;
  }) {
    const apiKey = params.code;

    const profile = await this.getAgentProfile(apiKey);

    return {
      id: profile.name || profile.id,
      name: profile.display_name || profile.name,
      accessToken: apiKey,
      refreshToken: '',
      expiresIn: dayjs().add(200, 'year').unix() - dayjs().unix(),
      picture: '',
      username: profile.name,
    };
  }

  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails[],
    integration: Integration
  ): Promise<PostResponse[]> {
    const results: PostResponse[] = [];

    for (const post of postDetails) {
      const postData: {
        submolt: string;
        title: string;
        content?: string;
        url?: string;
      } = {
        submolt: post.settings?.submolt || 'general',
        title: post.message.slice(0, 100),
        content: post.message,
      };

      let response;
      try {
        response = await this.getSsrfSafeAxios().post(
          `${MOLTBOOK_API_BASE}/posts`,
          postData,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (err: any) {
        throw sanitizeAxiosError(err, 'Failed to create post');
      }

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create post');
      }

      const postId = response.data.post.id;
      results.push({
        id: post.id,
        postId: String(postId),
        releaseURL: `https://www.moltbook.com/post/${postId}`,
        status: 'completed',
      });
    }

    return results;
  }

  async comment(
    id: string,
    postId: string,
    lastCommentId: string | undefined,
    accessToken: string,
    postDetails: PostDetails[],
    integration: Integration
  ): Promise<PostResponse[]> {
    const results: PostResponse[] = [];

    for (const post of postDetails) {
      const commentData: { content: string; parent_id?: string } = {
        content: post.message,
      };

      if (lastCommentId) {
        commentData.parent_id = lastCommentId;
      }

      let response;
      try {
        response = await this.getSsrfSafeAxios().post(
          `${MOLTBOOK_API_BASE}/posts/${postId}/comments`,
          commentData,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (err: any) {
        throw sanitizeAxiosError(err, 'Failed to create comment');
      }

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create comment');
      }

      const commentId = response.data.comment.id;
      results.push({
        id: post.id,
        postId: String(commentId),
        releaseURL: `https://www.moltbook.com/post/${postId}`,
        status: 'completed',
      });
    }

    return results;
  }
}
