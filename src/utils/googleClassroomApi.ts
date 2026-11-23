import { getAccessToken } from './googleClassroomAuth';

export interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  description?: string;
  room?: string;
  ownerId?: string;
  courseState?: 'ACTIVE' | 'ARCHIVED' | 'PROVISIONED' | 'DECLINED' | 'SUSPENDED';
  alternateLink?: string;
  enrollmentCode?: string;
}

export interface ClassroomTopic {
  courseId: string;
  topicId: string;
  name: string;
  updateTime?: string;
}

export interface ClassroomMaterial {
  link?: {
    url: string;
    title?: string;
  };
}

export interface ClassroomCourseWork {
  courseId: string;
  id: string;
  title: string;
  description?: string;
  materials?: ClassroomMaterial[];
  state?: 'PUBLISHED' | 'DRAFT' | 'DELETED';
  alternateLink?: string;
  creationTime?: string;
  updateTime?: string;
  maxPoints?: number;
  workType?: 'ASSIGNMENT' | 'SHORT_ANSWER_QUESTION' | 'MULTIPLE_CHOICE_QUESTION';
  topicId?: string;
}

export interface ClassroomCourseWorkMaterial {
  courseId: string;
  id: string;
  title: string;
  description?: string;
  materials?: ClassroomMaterial[];
  state?: 'PUBLISHED' | 'DRAFT' | 'DELETED';
  alternateLink?: string;
  creationTime?: string;
  topicId?: string;
}

export interface ClassroomAnnouncement {
  courseId: string;
  id: string;
  text: string;
  materials?: ClassroomMaterial[];
  state?: 'PUBLISHED' | 'DRAFT' | 'DELETED';
  alternateLink?: string;
  creationTime?: string;
}

export interface ClassroomStudent {
  courseId: string;
  userId: string;
  profile?: {
    id: string;
    name?: {
      givenName?: string;
      familyName?: string;
      fullName?: string;
    };
    emailAddress?: string;
    photoUrl?: string;
  };
}

export interface ClassroomStudentSubmission {
  courseId: string;
  courseWorkId: string;
  id: string;
  userId: string;
  state?: 'NEW' | 'CREATED' | 'TURNED_IN' | 'RETURNED' | 'RECLAIMED_BY_STUDENT';
  assignedGrade?: number;
  draftGrade?: number;
  alternateLink?: string;
  updateTime?: string;
  shortAnswerSubmission?: {
    answer?: string;
  };
}

export interface ClassroomPostDraft {
  kind: 'assignment' | 'question' | 'material' | 'announcement';
  title: string;
  description: string;
  maxPoints?: number;
  topicName?: string;
  linkUrl?: string;
  linkTitle?: string;
  sourceBadge?: string;
}

const CLASSROOM_BASE = 'https://classroom.googleapis.com/v1';

async function classroomFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  const res = await fetch(`${CLASSROOM_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    throw new Error('AUTH_REQUIRED');
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      detail = errJson?.error?.message || detail;
    } catch {
      // fallback
    }
    throw new Error(detail);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

export async function listClassroomCourses(): Promise<ClassroomCourse[]> {
  const data = await classroomFetch<{ courses?: ClassroomCourse[] }>('/courses?pageSize=30');
  return (data.courses ?? []).filter((c) => c.courseState !== 'DELETED' as any);
}

export async function listCourseTopics(courseId: string): Promise<ClassroomTopic[]> {
  try {
    const data = await classroomFetch<{ topic?: ClassroomTopic[] }>(
      `/courses/${encodeURIComponent(courseId)}/topics?pageSize=50`
    );
    return data.topic ?? [];
  } catch {
    return [];
  }
}

export async function createCourseTopic(
  courseId: string,
  name: string
): Promise<ClassroomTopic> {
  return classroomFetch<ClassroomTopic>(`/courses/${encodeURIComponent(courseId)}/topics`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function listCourseWork(courseId: string): Promise<ClassroomCourseWork[]> {
  try {
    const data = await classroomFetch<{ courseWork?: ClassroomCourseWork[] }>(
      `/courses/${encodeURIComponent(courseId)}/courseWork?pageSize=25`
    );
    return data.courseWork ?? [];
  } catch {
    return [];
  }
}

export async function listCourseWorkMaterials(
  courseId: string
): Promise<ClassroomCourseWorkMaterial[]> {
  try {
    const data = await classroomFetch<{ courseWorkMaterial?: ClassroomCourseWorkMaterial[] }>(
      `/courses/${encodeURIComponent(courseId)}/courseWorkMaterials?pageSize=20`
    );
    return data.courseWorkMaterial ?? [];
  } catch {
    return [];
  }
}

export async function listCourseAnnouncements(
  courseId: string
): Promise<ClassroomAnnouncement[]> {
  try {
    const data = await classroomFetch<{ announcements?: ClassroomAnnouncement[] }>(
      `/courses/${encodeURIComponent(courseId)}/announcements?pageSize=15`
    );
    return data.announcements ?? [];
  } catch {
    return [];
  }
}

export async function listCourseStudents(courseId: string): Promise<ClassroomStudent[]> {
  try {
    const data = await classroomFetch<{ students?: ClassroomStudent[] }>(
      `/courses/${encodeURIComponent(courseId)}/students?pageSize=50`
    );
    return data.students ?? [];
  } catch {
    return [];
  }
}

export async function listStudentSubmissions(
  courseId: string,
  courseWorkId: string
): Promise<ClassroomStudentSubmission[]> {
  try {
    const data = await classroomFetch<{ studentSubmissions?: ClassroomStudentSubmission[] }>(
      `/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(
        courseWorkId
      )}/studentSubmissions?pageSize=50`
    );
    return data.studentSubmissions ?? [];
  } catch {
    return [];
  }
}

export async function patchStudentSubmissionGrade(
  courseId: string,
  courseWorkId: string,
  submissionId: string,
  draftGrade: number,
  assignedGrade?: number
): Promise<ClassroomStudentSubmission> {
  const updateMask = assignedGrade !== undefined ? 'draftGrade,assignedGrade' : 'draftGrade';
  const body: Record<string, number> = { draftGrade };
  if (assignedGrade !== undefined) {
    body.assignedGrade = assignedGrade;
  }

  return classroomFetch<ClassroomStudentSubmission>(
    `/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(
      courseWorkId
    )}/studentSubmissions/${encodeURIComponent(submissionId)}?updateMask=${updateMask}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    }
  );
}

export async function createClassroomCourseWork(
  courseId: string,
  payload: {
    title: string;
    description: string;
    workType: 'ASSIGNMENT' | 'SHORT_ANSWER_QUESTION';
    maxPoints?: number;
    topicId?: string;
    linkUrl?: string;
    linkTitle?: string;
  }
): Promise<ClassroomCourseWork> {
  const materials: ClassroomMaterial[] = [];
  if (payload.linkUrl && /^https?:\/\//i.test(payload.linkUrl)) {
    materials.push({
      link: {
        url: payload.linkUrl,
        title: payload.linkTitle || 'Atlas Mpox · SUS',
      },
    });
  }

  const body: Record<string, unknown> = {
    title: payload.title,
    description: payload.description,
    workType: payload.workType,
    state: 'PUBLISHED',
  };
  if (typeof payload.maxPoints === 'number' && payload.maxPoints >= 0) {
    body.maxPoints = payload.maxPoints;
  }
  if (payload.topicId) {
    body.topicId = payload.topicId;
  }
  if (materials.length > 0) {
    body.materials = materials;
  }

  return classroomFetch<ClassroomCourseWork>(
    `/courses/${encodeURIComponent(courseId)}/courseWork`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
}

export async function createClassroomMaterial(
  courseId: string,
  payload: {
    title: string;
    description: string;
    topicId?: string;
    linkUrl?: string;
    linkTitle?: string;
  }
): Promise<ClassroomCourseWorkMaterial> {
  const materials: ClassroomMaterial[] = [];
  if (payload.linkUrl && /^https?:\/\//i.test(payload.linkUrl)) {
    materials.push({
      link: {
        url: payload.linkUrl,
        title: payload.linkTitle || 'Atlas Mpox · SUS',
      },
    });
  }

  const body: Record<string, unknown> = {
    title: payload.title,
    description: payload.description,
    state: 'PUBLISHED',
  };
  if (payload.topicId) {
    body.topicId = payload.topicId;
  }
  if (materials.length > 0) {
    body.materials = materials;
  }

  return classroomFetch<ClassroomCourseWorkMaterial>(
    `/courses/${encodeURIComponent(courseId)}/courseWorkMaterials`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
}

export async function createClassroomAnnouncement(
  courseId: string,
  payload: {
    text: string;
    linkUrl?: string;
    linkTitle?: string;
  }
): Promise<ClassroomAnnouncement> {
  const materials: ClassroomMaterial[] = [];
  if (payload.linkUrl && /^https?:\/\//i.test(payload.linkUrl)) {
    materials.push({
      link: {
        url: payload.linkUrl,
        title: payload.linkTitle || 'Atlas Mpox · SUS',
      },
    });
  }

  const body: Record<string, unknown> = {
    text: payload.text,
    state: 'PUBLISHED',
  };
  if (materials.length > 0) {
    body.materials = materials;
  }

  return classroomFetch<ClassroomAnnouncement>(
    `/courses/${encodeURIComponent(courseId)}/announcements`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
}
