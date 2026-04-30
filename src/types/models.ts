export type UserRole = 'admin' | 'cleaner' | 'annotator' | 'trainer'
export type TaskStatus =
  | 'pending_clean'
  | 'pending_annotate'
  | 'pending_train'
  | 'finished'

export type UploadPurpose =
  | 'task_source'
  | 'task_cleaned'
  | 'task_annotated'
  | 'task_model'

export type AuthUser = {
  id: number
  username: string
  role: UserRole
  createdAt: string
}

export type AuthSession = {
  token: string
  user: AuthUser
}

export type UserSummary = {
  id: number
  username: string
  role: UserRole
  createdAt: string
}

export type PaginationMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type UserListSummary = {
  total: number
  adminCount: number
  workerCount: number
}

export type UserListResponse = {
  items: UserSummary[]
  pagination: PaginationMeta
  summary: UserListSummary
}

export type TaskAssignee = {
  id: number
  username: string
}

export type TaskSummary = {
  id: number
  title: string
  description: string
  status: TaskStatus
  statusLabel: string
  createdAt: string
  finishedAt: string | null
  creator: TaskAssignee
  assignees: {
    cleaner: TaskAssignee
    annotator: TaskAssignee
    trainer: TaskAssignee
  }
  myRole: UserRole
  canHandle: boolean
}

export type TaskListSummary = {
  total: number
  actionableCount: number
  finishedCount: number
}

export type TaskListResponse = {
  items: TaskSummary[]
  pagination: PaginationMeta
  summary: TaskListSummary
}

export type TaskDownload = {
  alias: 'source' | 'cleaned' | 'annotated' | 'model'
  label: string
  fileName: string
  endpoint: string
  canPreview: boolean
  previewEndpoint: string | null
}

export type TaskDetail = TaskSummary & {
  remarks: {
    cleaner: string | null
    annotator: string | null
    trainer: string | null
  }
  downloads: TaskDownload[]
  canSubmitCurrentStage: boolean
  currentStage: {
    role: UserRole | null
    label: string
  }
}

export type UploadedFileRef = {
  storageKey: string
  originalName: string
  mimeType: string
  size: number
}

export type TaskArchivePreviewItem = {
  id: string
  name: string
  mimeType: string
  size: number
  endpoint: string
}

export type TaskArchivePreviewPage = {
  items: TaskArchivePreviewItem[]
  pagination: PaginationMeta
}
