const modules = import.meta.glob('../pdf/*.pdf', {
  eager: true,
  query: '?url',
  import: 'default',
});

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

export const pdfCatalog = Object.entries(modules)
  .map(([path, url]) => {
    const filename = path.split('/').pop() ?? path;

    return {
      filename,
      title: filename.replace(/\.pdf$/i, ''),
      url,
    };
  })
  .sort((left, right) => collator.compare(left.filename, right.filename));
