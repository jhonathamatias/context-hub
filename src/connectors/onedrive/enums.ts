export enum OneDriveShareKind {
  Folder = 'folder',
  Video = 'video',
  Unsupported = 'unsupported',
}

export enum OneDriveVideoExtension {
  Mp4 = 'mp4',
  Mov = 'mov',
  Webm = 'webm',
  Mkv = 'mkv',
}

export enum OneDriveGraphResource {
  DriveItem = 'driveItem',
  Children = 'children',
  Content = 'content',
}

export enum OneDriveOrigin {
  OneDrive = 'onedrive',
}

export enum GraphHttpStatus {
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
}
