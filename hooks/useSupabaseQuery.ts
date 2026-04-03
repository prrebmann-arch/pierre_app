import useSWR from 'swr'

export function useSupabaseQuery<T>(
  key: string | null,
  queryFn: () => Promise<{ data: T | null; error: any }>,
  options?: { revalidateOnFocus?: boolean; dedupingInterval?: number },
) {
  return useSWR(
    key,
    async () => {
      const result = await queryFn()
      if (result.error) throw result.error
      return result.data
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      ...options,
    },
  )
}
