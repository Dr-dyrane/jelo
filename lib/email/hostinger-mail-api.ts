const hostingerMailApiOrigin = 'https://api.mail.hostinger.com';

type Fetcher = typeof fetch;

type Mailbox = {
  resourceId: string;
  address: string;
};

type AccountResponse = {
  data?: {
    mailboxes?: unknown;
  };
};

function mailboxesFromResponse(value: unknown): Mailbox[] {
  if (!value || typeof value !== 'object') return [];
  const mailboxes = (value as AccountResponse).data?.mailboxes;
  if (!Array.isArray(mailboxes)) return [];
  return mailboxes.flatMap(mailbox => {
    if (!mailbox || typeof mailbox !== 'object') return [];
    const resourceId = 'resourceId' in mailbox ? mailbox.resourceId : null;
    const address = 'address' in mailbox ? mailbox.address : null;
    return typeof resourceId === 'string' && resourceId.length > 0
      && typeof address === 'string' && address.length > 0
      ? [{ resourceId, address }]
      : [];
  });
}

async function responseJson(response: Response) {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

export async function resolveHostingerMailboxResourceId(input: {
  apiToken: string;
  fromAddress: string;
  fetcher?: Fetcher;
}) {
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher(`${hostingerMailApiOrigin}/api/v1/me`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${input.apiToken}`,
    },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`hostinger_mail_account_${response.status}`);

  const expected = input.fromAddress.trim().toLocaleLowerCase('en');
  const mailbox = mailboxesFromResponse(await responseJson(response))
    .find(candidate => candidate.address.toLocaleLowerCase('en') === expected);
  if (!mailbox) throw new Error('hostinger_mailbox_not_available');
  return mailbox.resourceId;
}

export async function sendHostingerMailViaApi(input: {
  apiToken: string;
  mailboxResourceId: string;
  to: string;
  displayName: string;
  subject: string;
  text: string;
  html: string;
  fetcher?: Fetcher;
}) {
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher(
    `${hostingerMailApiOrigin}/api/v1/mailboxes/${encodeURIComponent(input.mailboxResourceId)}/send`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${input.apiToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        to: [input.to],
        displayName: input.displayName,
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
      cache: 'no-store',
    },
  );
  if (!response.ok) throw new Error(`hostinger_mail_send_${response.status}`);
}
