import { useEffect, useRef, useState } from 'react'

function getOuterHeight(element: HTMLElement) {
  const styles = window.getComputedStyle(element)
  const marginTop = Number.parseFloat(styles.marginTop) || 0
  const marginBottom = Number.parseFloat(styles.marginBottom) || 0

  return element.offsetHeight + marginTop + marginBottom
}

export function useTableScrollY() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scrollY, setScrollY] = useState<number | null>(null)

  useEffect(() => {
    const container = containerRef.current

    if (!container || typeof window === 'undefined') {
      return
    }

    let frameId = 0

    const measure = () => {
      frameId = 0

      const currentContainer = containerRef.current

      if (!currentContainer || currentContainer.clientHeight <= 0) {
        return
      }

      const headerElement =
        currentContainer.querySelector<HTMLElement>('.ant-table-header') ??
        currentContainer.querySelector<HTMLElement>('.ant-table-thead')
      const paginationElement =
        currentContainer.querySelector<HTMLElement>('.ant-table-pagination')

      const headerHeight = headerElement
        ? Math.ceil(headerElement.getBoundingClientRect().height)
        : 0
      const paginationHeight = paginationElement
        ? Math.ceil(getOuterHeight(paginationElement))
        : 0

      // 滚动区域高度必须精确等于容器剩余空间，否则低视口下会再次把页面撑高。
      const nextScrollY = Math.max(
        currentContainer.clientHeight - headerHeight - paginationHeight - 2,
        1,
      )

      setScrollY((previousValue) =>
        previousValue === nextScrollY ? previousValue : nextScrollY,
      )
    }

    const scheduleMeasure = () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }

      frameId = window.requestAnimationFrame(measure)
    }

    scheduleMeasure()

    const resizeObserver = new ResizeObserver(scheduleMeasure)
    resizeObserver.observe(container)

    const mutationObserver = new MutationObserver(scheduleMeasure)
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
    })

    window.addEventListener('resize', scheduleMeasure)

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }

      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
    }
  }, [])

  return {
    containerRef,
    scrollY,
  }
}
