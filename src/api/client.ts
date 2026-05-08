import type {
  AuthSession,
  ModelIterationDetail,
  ModelIterationListResponse,
  ModelIterationSummary,
  ModelListResponse,
  TaskArchivePreviewPage,
  TaskDetail,
  TaskDownloadLink,
  TaskListResponse,
  TaskReviewStatus,
  TaskReviewStage,
  TaskStatus,
  UploadPurpose,
  UploadedFileRef,
  UserListResponse,
  UserSummary,
} from '../types/models'

type RequestOptions = RequestInit & {
  token?: string
}

type ApiErrorPayload = {
  error?: {
    message?: string
  }
}

export type ChunkUploadSession = {
  uploadId: string
  tusEndpoint: string
  uploadUrl: string
  createUrl: string
  expiresAt: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

function resolveDownloadUrl(url: string): string {
  const apiBaseUrl = API_BASE_URL
    ? new URL(API_BASE_URL, window.location.origin).toString()
    : window.location.origin

  // 后端在未配置 FILE_BASE_URL 时会返回相对地址，前端这里统一按实际 API 基址补全，
  // 避免浏览器把下载链接错误解析到 127.0.0.1 或错误的前端域名上。
  return new URL(url, apiBaseUrl).toString()
}

function buildQueryString(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) {
      return
    }

    searchParams.set(key, String(value))
  })

  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function parseJsonSafely<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    return null
  }

  return (await response.json()) as T
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const payload = await parseJsonSafely<ApiErrorPayload>(response)
    throw new ApiError(
      payload?.error?.message || `请求失败，状态码 ${response.status}`,
      response.status,
    )
  }

  const payload = await parseJsonSafely<T>(response)

  if (payload === null) {
    throw new ApiError('服务端返回了非 JSON 响应。', response.status)
  }

  return payload
}

export async function login(
  username: string,
  password: string,
): Promise<AuthSession> {
  return request<AuthSession>('/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      password,
    }),
  })
}

export async function getUsers(
  token: string,
  options?: {
    page?: number
    pageSize?: number
    all?: boolean
  },
): Promise<UserListResponse> {
  const payload = await request<UserListResponse>(
    `/api/v1/users${buildQueryString({
      page: options?.page,
      pageSize: options?.pageSize,
      all: options?.all,
    })}`,
    {
      token,
    },
  )

  return payload
}

export async function getTasks(
  token: string,
  options?: {
    page?: number
    pageSize?: number
    keyword?: string
    status?: TaskStatus
    reviewStatus?: TaskReviewStatus
  },
): Promise<TaskListResponse> {
  const payload = await request<TaskListResponse>(
    `/api/v1/tasks${buildQueryString({
      page: options?.page,
      pageSize: options?.pageSize,
      keyword: options?.keyword?.trim() || undefined,
      status: options?.status,
      reviewStatus: options?.reviewStatus,
    })}`,
    {
      token,
    },
  )

  return payload
}

export async function getModels(
  token: string,
  options?: {
    page?: number
    pageSize?: number
    keyword?: string
    modelIterationId?: number
  },
): Promise<ModelListResponse> {
  return request<ModelListResponse>(
    `/api/v1/models${buildQueryString({
      page: options?.page,
      pageSize: options?.pageSize,
      keyword: options?.keyword?.trim() || undefined,
      modelIterationId: options?.modelIterationId,
    })}`,
    {
      token,
    },
  )
}

export async function getModelIterations(
  token: string,
  options?: {
    page?: number
    pageSize?: number
    keyword?: string
    all?: boolean
  },
): Promise<ModelIterationListResponse> {
  return request<ModelIterationListResponse>(
    `/api/v1/model-iterations${buildQueryString({
      page: options?.page,
      pageSize: options?.pageSize,
      keyword: options?.keyword?.trim() || undefined,
      all: options?.all,
    })}`,
    {
      token,
    },
  )
}

export async function getModelIterationDetail(
  modelIterationId: number,
  token: string,
): Promise<ModelIterationDetail> {
  return request<ModelIterationDetail>(`/api/v1/model-iterations/${modelIterationId}`, {
    token,
  })
}

export async function createModelIteration(
  payload: {
    name: string
    description: string
    baseModelName: string
    goal: string
  },
  token: string,
): Promise<ModelIterationSummary> {
  const response = await request<{ item: ModelIterationSummary }>(
    '/api/v1/model-iterations',
    {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  )

  return response.item
}

export async function markCurrentBestModelResult(
  modelIterationId: number,
  taskId: number,
  token: string,
): Promise<ModelIterationDetail | null> {
  const response = await request<{ item: ModelIterationDetail | null }>(
    `/api/v1/model-iterations/${modelIterationId}/current-best-task`,
    {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskId }),
    },
  )

  return response.item
}

export async function createUser(
  payload: {
    username: string
    password: string
    role: UserSummary['role']
  },
  token: string,
): Promise<UserSummary> {
  const response = await request<{ item: UserSummary }>('/api/v1/users', {
    method: 'POST',
    token,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return response.item
}

export async function updateUser(
  userId: number,
  payload: {
    username: string
    password?: string
  },
  token: string,
): Promise<UserSummary> {
  const response = await request<{ item: UserSummary }>(`/api/v1/users/${userId}`, {
    method: 'PUT',
    token,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return response.item
}

export async function deleteUser(userId: number, token: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const payload = await parseJsonSafely<ApiErrorPayload>(response)
    throw new ApiError(
      payload?.error?.message || `请求失败，状态码 ${response.status}`,
      response.status,
    )
  }
}

export async function getTaskDetail(
  taskId: number,
  token: string,
): Promise<TaskDetail> {
  return request<TaskDetail>(`/api/v1/tasks/${taskId}`, {
    token,
  })
}

export async function createTask(
  payload: {
    modelIterationId: number
    title: string
    description: string
    needCleanReview: boolean
    needAnnotateReview: boolean
    needTrainReview: boolean
    cleanerId: number
    annotatorId: number
    trainerId: number
    sourceFile: UploadedFileRef
  },
  token: string,
): Promise<TaskDetail | null> {
  const response = await request<{ item: TaskDetail | null }>('/api/v1/tasks', {
    method: 'POST',
    token,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return response.item
}

export async function deleteTask(taskId: number, token: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tasks/${taskId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const payload = await parseJsonSafely<ApiErrorPayload>(response)
    throw new ApiError(
      payload?.error?.message || `请求失败，状态码 ${response.status}`,
      response.status,
    )
  }
}

export async function completeTaskStage(
  taskId: number,
  payload: {
    file: UploadedFileRef
    remark: string
  },
  token: string,
): Promise<TaskDetail | null> {
  const response = await request<{ item: TaskDetail | null }>(
    `/api/v1/tasks/${taskId}/complete-stage`,
    {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  )

  return response.item
}

export async function reviewTaskStage(
  taskId: number,
  payload: {
    action: 'approve' | 'reject'
    reviewStage: TaskReviewStage
    reviewComment?: string
  },
  token: string,
): Promise<TaskDetail | null> {
  const response = await request<{ item: TaskDetail | null }>(
    `/api/v1/tasks/${taskId}/review`,
    {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  )

  return response.item
}

export async function createChunkUploadSession(
  file: File,
  token: string,
  options?: {
    purpose?: UploadPurpose
  },
): Promise<ChunkUploadSession> {
  const response = await request<{ item: ChunkUploadSession }>('/api/v1/files/uploads', {
    method: 'POST',
    token,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      originalName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      purpose: options?.purpose,
    }),
  })

  return response.item
}

export async function finalizeChunkUpload(
  uploadId: string,
  token: string,
): Promise<UploadedFileRef> {
  const response = await request<{ item: UploadedFileRef }>(
    `/api/v1/files/uploads/${uploadId}/complete`,
    {
      method: 'POST',
      token,
    },
  )

  return response.item
}

export async function uploadBinaryFile(
  file: File,
  token: string,
  options?: {
    purpose?: UploadPurpose
  },
): Promise<UploadedFileRef> {
  const formData = new FormData()
  formData.append('file', file, file.name)
  formData.append('originalName', file.name)

  if (options?.purpose) {
    formData.append('purpose', options.purpose)
  }

  const response = await request<{ item: UploadedFileRef }>('/api/v1/files/upload', {
    method: 'POST',
    token,
    body: formData,
  })

  return response.item
}

export async function downloadTaskFile(
  endpoint: string,
  token: string,
): Promise<void> {
  // 大文件下载不能走 fetch + blob；这里改为申请临时签名链接后交给浏览器原生下载器处理。
  const { url } = await getTaskFileDownloadLink(`${endpoint}-link`, token)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export async function getTaskFileDownloadLink(
  endpoint: string,
  token: string,
): Promise<TaskDownloadLink> {
  const payload = await request<TaskDownloadLink>(endpoint, {
    token,
  })

  return {
    ...payload,
    url: resolveDownloadUrl(payload.url),
  }
}

export async function getTaskFilePreviewPage(
  endpoint: string,
  token: string,
  options?: {
    page?: number
    pageSize?: number
  },
): Promise<TaskArchivePreviewPage> {
  return request<TaskArchivePreviewPage>(
    `${endpoint}${buildQueryString({
      page: options?.page,
      pageSize: options?.pageSize,
    })}`,
    {
      token,
    },
  )
}

export async function getProtectedBlob(
  endpoint: string,
  token: string,
): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const payload = await parseJsonSafely<ApiErrorPayload>(response)
    throw new ApiError(
      payload?.error?.message || `请求失败，状态码 ${response.status}`,
      response.status,
    )
  }

  return response.blob()
}
