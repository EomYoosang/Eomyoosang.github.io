import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import PdfCanvas from './components/PdfCanvas';
import { pdfCatalog } from './pdfCatalog';

GlobalWorkerOptions.workerSrc = workerUrl;

function formatPageTitle(entry, pageNumber, totalPages) {
  return totalPages === 1 ? entry.title : `${entry.title} · ${pageNumber}`;
}

export default function App() {
  const [pages, setPages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const pageRefs = useRef([]);

  useEffect(() => {
    let isCancelled = false;
    const loadingTasks = [];

    const loadPages = async () => {
      try {
        const pageEntries = [];

        for (const entry of pdfCatalog) {
          const loadingTask = getDocument(entry.url);
          loadingTasks.push(loadingTask);
          const pdf = await loadingTask.promise;

          for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            pageEntries.push({
              id: `${entry.filename}-${pageNumber}`,
              label: formatPageTitle(entry, pageNumber, pdf.numPages),
              pdf,
              pageNumber,
            });
          }
        }

        if (!isCancelled) {
          setPages(pageEntries);
          setStatus('ready');
        }
      } catch (error) {
        if (!isCancelled) {
          setStatus('error');
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'PDF를 불러오는 중 문제가 발생했습니다.',
          );
        }
      }
    };

    loadPages();

    return () => {
      isCancelled = true;
      loadingTasks.forEach((task) => task.destroy());
    };
  }, []);

  const currentPage = pages[currentIndex];
  const totalPages = pages.length;

  const goToPage = (index, behavior = 'smooth') => {
    if (!pages.length) {
      return;
    }

    const nextIndex = Math.max(0, Math.min(index, pages.length - 1));
    const pageElement = pageRefs.current[nextIndex];

    setCurrentIndex(nextIndex);
    pageElement?.scrollIntoView({
      behavior,
      block: 'start',
    });
  };

  useEffect(() => {
    if (!pages.length) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        goToPage(currentIndex + 1);
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        goToPage(currentIndex - 1);
      }

      if (event.key === 'Home') {
        event.preventDefault();
        goToPage(0);
      }

      if (event.key === 'End') {
        event.preventDefault();
        goToPage(pages.length - 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentIndex, pages.length]);

  useEffect(() => {
    if (!pages.length) {
      return undefined;
    }

    const syncCurrentPage = () => {
      const anchor = window.scrollY + window.innerHeight * 0.35;
      let nextIndex = 0;

      for (let index = 0; index < pageRefs.current.length; index += 1) {
        const pageElement = pageRefs.current[index];

        if (!pageElement) {
          continue;
        }

        if (pageElement.offsetTop <= anchor) {
          nextIndex = index;
          continue;
        }

        break;
      }

      setCurrentIndex((value) => (value === nextIndex ? value : nextIndex));
    };

    syncCurrentPage();

    window.addEventListener('scroll', syncCurrentPage, { passive: true });
    window.addEventListener('resize', syncCurrentPage);

    return () => {
      window.removeEventListener('scroll', syncCurrentPage);
      window.removeEventListener('resize', syncCurrentPage);
    };
  }, [pages.length]);

  if (status === 'error') {
    return (
      <main className="app-shell app-shell--centered">
        <section className="message-card">
          <h1>PDF를 열 수 없습니다</h1>
          <p>{errorMessage}</p>
        </section>
      </main>
    );
  }

  if (status === 'ready' && !currentPage) {
    return (
      <main className="app-shell app-shell--centered">
        <section className="message-card">
          <h1>표시할 PDF가 없습니다</h1>
          <p>`pdf/` 폴더에 PDF 파일을 추가한 뒤 다시 빌드하면 됩니다.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      {status === 'loading' ? (
        <section className="message-card">
          <h1>PDF 페이지를 불러오는 중입니다</h1>
          <p>문서 수와 페이지 수를 확인한 뒤 뷰어를 준비합니다.</p>
        </section>
      ) : (
        <>
          <aside className="page-nav" aria-label="페이지 이동">
            {pages.map((page, index) => (
              <button
                key={page.id}
                type="button"
                className={`page-nav__button ${
                  index === currentIndex ? 'page-nav__button--active' : ''
                }`}
                onClick={() => goToPage(index)}
                aria-label={`${index + 1}페이지로 이동`}
                aria-current={index === currentIndex ? 'page' : undefined}
              >
                {index + 1}
              </button>
            ))}
          </aside>

          <section className="page-list" aria-label={`PDF pages ${totalPages}`}>
            {pages.map((page, index) => (
              <section
                key={page.id}
                ref={(node) => {
                  pageRefs.current[index] = node;
                }}
                className="page-item"
                aria-label={page.label}
              >
                <PdfCanvas
                  pdf={page.pdf}
                  pageNumber={page.pageNumber}
                  className="page-canvas"
                />
              </section>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
