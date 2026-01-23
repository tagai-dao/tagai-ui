// tagai-ui/src/sdk/miniapp-core/src/actions/SignIn.ts
// SignIn action - authenticate user with signature

export namespace SignIn {
  export type SignInOptions = {
    nonce: string
    notBefore?: string
    expirationTime?: string
    /**
     * Accept signature from connected wallet address
     */
    acceptAuthAddress?: boolean
  }

  export type SignInResult = {
    signature: string
    message: string
    /**
     * Method used for signing: 'wallet' (connected wallet) or 'twitter' (Twitter OAuth)
     */
    authMethod: 'wallet' | 'twitter'
    address?: string  // Ethereum address if wallet signing
    twitterId?: string  // Twitter ID if Twitter OAuth
  }

  export type SignInError =
    | { type: 'rejected_by_user' }
    | { type: 'generic_error'; message: string }

  export type SignInResponse =
    | { result: SignInResult }
    | { error: SignInError }

  export type SignIn = (
    options: SignInOptions,
  ) => Promise<SignInResponse>

  export type WireSignIn = SignIn

  export class RejectedByUser extends Error {
    constructor() {
      super('User rejected the sign in request')
    }
  }

  export class GenericError extends Error {
    constructor(message: string) {
      super(message)
    }
  }
}
