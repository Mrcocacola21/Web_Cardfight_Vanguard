import { LoadingState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'

export default function CatalogLoading() {
  return (
    <PageContainer
      as="main"
      size="wide"
      className="flex min-h-screen items-center py-14"
    >
      <LoadingState
        title="Loading catalog"
        description="Preparing the server-rendered catalog view."
      />
    </PageContainer>
  )
}
