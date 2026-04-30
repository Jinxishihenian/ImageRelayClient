import type {
  AuthSession,
  TaskArchivePreviewPage,
  TaskDetail,
  TaskDownloadLink,
  TaskListResponse,
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

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
  },
): Promise<TaskListResponse> {
  const payload = await request<TaskListResponse>(
    `/api/v1/tasks${buildQueryString({
      page: options?.page,
      pageSize: options?.pageSize,
      keyword: options?.keyword?.trim() || undefined,
    })}`,
    {
      token,
    },
  )

  return payload
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
    title: string
    description: string
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

export async function uploadBinaryFile(
  file: File,
  token: string,
  options?: {
    purpose?: UploadPurpose
  },
): Promise<UploadedFileRef> {
  const headers: Record<string, string> = {
    'Content-Type': file.type || 'application/octet-stream',
    'X-File-Name': encodeURIComponent(file.name),
  }

  if (options?.purpose) {
    headers['X-Upload-Purpose'] = options.purpose
  }

  const response = await request<{ item: UploadedFileRef }>('/api/v1/files/upload', {
    method: 'POST',
    token,
    headers,
    body: await file.arrayBuffer(),
  })

  return response.item
}

export async function downloadTaskFile(
  endpoint: string,
  fileName: string,
  token: string,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const payload = await parseJsonSafely<ApiErrorPayload>(response)
    throw new ApiError(
      payload?.error?.message || `下载失败，状态码 ${response.status}`,
      response.status,
    )
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function getTaskFileDownloadLink(
  endpoint: string,
  token: string,
): Promise<TaskDownloadLink> {
  return request<TaskDownloadLink>(endpoint, {
    token,
  })
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
