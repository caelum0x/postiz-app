'use client';

import {
  createContext,
  FC,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';

export interface PreviewComment {
  id: string;
  postId: string;
  parentId: string | null;
  content: string;
  anchorStart: number | null;
  anchorEnd: number | null;
  anchorQuote: string | null;
  resolvedAt: string | null;
  isApproval: boolean;
  createdAt: string;
  name: string | null;
  mentionedUserIds: string[];
  assignedToId: string | null;
  assignedToName: string | null;
}

export interface CommentTeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface PendingAnchor {
  postId: string;
  start: number;
  end: number;
  quote: string;
}

// Which side asked for the focus decides which side scrolls: a click on a
// highlight scrolls the card into view, a click on a card quote scrolls the
// highlight into view.
export interface ActiveThread {
  id: string;
  source: 'mark' | 'card';
}

// `useAuthed` picks the authenticated route (org-scoped, so it returns the
// mention/assignment identities) vs. the fully public one (same comments,
// those identities stripped) - see PostsService.getComments's
// includeInternal gate. Matches CommentComposer's own
// user?.id-vs-public branching for which endpoint to POST to.
const useComments = (previewId: string, useAuthed: boolean) => {
  const fetch = useFetch();
  const path = useAuthed
    ? `/posts/${previewId}/comments`
    : `/public/posts/${previewId}/comments`;
  const load = useCallback(async () => {
    return (await fetch(path)).json();
  }, [path]);
  return useSWR<{ comments: PreviewComment[] }>(path, load);
};

// Backs the @mention/assign picker - only fetched for a logged-in team
// member viewing their own org's preview (the public reviewer never needs,
// or is allowed to see, the team list). A disabled SWR key (null) skips the
// request entirely rather than firing it and discarding the result.
const useCommentTeamMembers = (enabled: boolean) => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await fetch('/posts/comments/team-members')).json();
  }, []);
  return useSWR<CommentTeamMember[]>(
    enabled ? '/posts/comments/team-members' : null,
    load
  );
};

interface PreviewCommentsContextInterface {
  previewId: string;
  postIds: string[];
  organizationId: string;
  postState: string;
  comments: PreviewComment[];
  isLoading: boolean;
  mutate: () => Promise<any>;
  pending: PendingAnchor | null;
  setPending: (pending: PendingAnchor | null) => void;
  activeThread: ActiveThread | null;
  setActiveThread: (thread: ActiveThread | null) => void;
  hoveredThread: string | null;
  setHoveredThread: (id: string | null) => void;
  teamMembers: CommentTeamMember[];
  canMention: boolean;
}

const PreviewCommentsContext = createContext<PreviewCommentsContextInterface>(
  {} as PreviewCommentsContextInterface
);

export const PreviewCommentsProvider: FC<{
  previewId: string;
  postIds: string[];
  organizationId: string;
  postState: string;
  children: ReactNode;
}> = ({ previewId, postIds, organizationId, postState, children }) => {
  const [pending, setPending] = useState<PendingAnchor | null>(null);
  const [activeThread, setActiveThread] = useState<ActiveThread | null>(null);
  const [hoveredThread, setHoveredThread] = useState<string | null>(null);
  const user = useUser();
  const canMention = !!user?.id && user?.orgId === organizationId;
  const { data, mutate, isLoading } = useComments(previewId, canMention);
  const { data: teamMembers } = useCommentTeamMembers(canMention);

  return (
    <PreviewCommentsContext.Provider
      value={{
        previewId,
        postIds,
        organizationId,
        postState,
        comments: data?.comments || [],
        isLoading,
        mutate,
        pending,
        setPending,
        activeThread,
        setActiveThread,
        hoveredThread,
        setHoveredThread,
        teamMembers: teamMembers || [],
        canMention,
      }}
    >
      {children}
    </PreviewCommentsContext.Provider>
  );
};

export const usePreviewComments = () => useContext(PreviewCommentsContext);
