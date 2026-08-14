const hostingerMailApiOrigin = "https://api.mail.hostinger.com";

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

export class HostingerMailApiError extends Error {
  constructor(
    code: string,
    public readonly deliveryAttempted: boolean,
    public readonly safeToFallback: boolean,
  ) {
    super(code);
    this.name = "HostingerMailApiError";
  }
}

export function isSafeHostingerMailApiFallback(error: unknown) {
  return error instanceof HostingerMailApiError && error.safeToFallback;
}

function mailboxesFromResponse(value: unknown): Mailbox[] {
  if (!value || typeof value !== "object") return [];
  const mailboxes = (value as AccountResponse).data?.mailboxes;
  if (!Array.isArray(mailboxes)) return [];
  return mailboxes.flatMap((mailbox) => {
    if (!mailbox || typeof mailbox !== "object") return [];
    const resourceId = "resourceId" in mailbox ? mailbox.resourceId : null;
    const address = "address" in mailbox ? mailbox.address : null;
    return typeof resourceId === "string" &&
      resourceId.length > 0 &&
      typeof address === "string" &&
      address.length > 0
      ? [{ resourceId, address }]
      : [];
  });
}

async function responseJson(response: Response) {
  try {
    return (await response.json()) as unknown;
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
  let response: Response;
  try {
    response = await fetcher(`${hostingerMailApiOrigin}/api/v1/me`, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${input.apiToken}`,
      },
      cache: "no-store",
    });
  } catch {
    // Mailbox discovery cannot have accepted a message, so SMTP is safe here.
    throw new HostingerMailApiError(
      "hostinger_mail_account_unavailable",
      false,
      true,
    );
  }
  if (!response.ok) {
    throw new HostingerMailApiError(
      `hostinger_mail_account_${response.status}`,
      false,
      true,
    );
  }

  const expected = input.fromAddress.trim().toLocaleLowerCase("en");
  const mailbox = mailboxesFromResponse(await responseJson(response)).find(
    (candidate) => candidate.address.toLocaleLowerCase("en") === expected,
  );
  if (!mailbox)
    throw new HostingerMailApiError(
      "hostinger_mailbox_not_available",
      false,
      true,
    );
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
  let response: Response;
  try {
    response = await fetcher(
      `${hostingerMailApiOrigin}/api/v1/mailboxes/${encodeURIComponent(input.mailboxResourceId)}/send`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${input.apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          to: [input.to],
          displayName: input.displayName,
          subject: input.subject,
          text: input.text,
          html: input.html,
        }),
        cache: "no-store",
      },
    );
  } catch {
    // A network failure after POST begins has an uncertain acceptance state.
    throw new HostingerMailApiError(
      "hostinger_mail_send_uncertain",
      true,
      false,
    );
  }
  if (!response.ok) {
    const explicitClientRejection =
      response.status >= 400 &&
      response.status < 500 &&
      response.status !== 408;
    throw new HostingerMailApiError(
      `hostinger_mail_send_${response.status}`,
      true,
      explicitClientRejection,
    );
  }
}
