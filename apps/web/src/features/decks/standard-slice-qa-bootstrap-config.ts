interface StandardSliceQaBootstrapEnv {
  readonly ENABLE_STANDARD_SLICE_QA_BOOTSTRAP?: string
  readonly NODE_ENV?: string
}

export function isStandardSliceQaBootstrapEnabled(
  env: StandardSliceQaBootstrapEnv = process.env,
): boolean {
  if (env.ENABLE_STANDARD_SLICE_QA_BOOTSTRAP === 'true') {
    return true
  }

  if (env.ENABLE_STANDARD_SLICE_QA_BOOTSTRAP === 'false') {
    return false
  }

  return env.NODE_ENV !== 'production'
}
