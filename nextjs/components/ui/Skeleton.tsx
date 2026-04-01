interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
}

export default function Skeleton({ width, height, borderRadius }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      style={{
        width: width ?? '100%',
        height: height ?? 16,
        borderRadius,
      }}
    />
  )
}
