const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const DRIVE_SCOPE      = 'https://www.googleapis.com/auth/drive.file';

let driveAccessToken: string | null = null;

export function getAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (driveAccessToken) { resolve(driveAccessToken); return; }

    const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope:     DRIVE_SCOPE,
      callback:  (response: any) => {
        if (response.error) {
          reject(response);
        } else {
          driveAccessToken = response.access_token;
          resolve(driveAccessToken as string);
        }
      },
    });
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

export function getOrCreateDriveFolder(folderName: string, accessToken: string): Promise<string> {
  const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
  return fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
    .then((r) => r.json())
    .then((data: any) => {
      if (data.files && data.files.length > 0) return data.files[0].id;
      return fetch('https://www.googleapis.com/drive/v3/files', {
        method:  'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder' }),
      })
        .then((r) => r.json())
        .then((folder: any) => folder.id);
    });
}

export function uploadToDrive(blob: Blob, filename: string, accessToken: string, parentId?: string): Promise<any> {
  const metadata: any = { name: filename, mimeType: 'application/pdf' };
  if (parentId) metadata.parents = [parentId];

  const boundary = 'antigo_drive_upload_boundary';
  const body = new Blob(
    [
      `--${boundary}\r\n`,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata) + '\r\n',
      `--${boundary}\r\n`,
      'Content-Type: application/pdf\r\n\r\n',
      blob,
      `\r\n--${boundary}--`,
    ],
    { type: `multipart/related; boundary=${boundary}` },
  );

  return fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  }).then((res) => {
    if (!res.ok) {
      if (res.status === 401) driveAccessToken = null;
      return res.json().then((err: any) => { throw err; });
    }
    return res.json();
  });
}

export function saveToDrive(blob: Blob, filename: string): Promise<any> {
  return getAccessToken().then((token) =>
    getOrCreateDriveFolder('factures', token).then((folderId) =>
      uploadToDrive(blob, filename, token, folderId),
    ),
  );
}
