export default function SectionCard({
  eyebrow = '',
  title,
  description = '',
  children,
  className = '',
}) {
  return (
    <section
      className={`rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm shadow-gray-100/70 md:p-7 ${className}`.trim()}
    >
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
          {eyebrow}
        </p>
      ) : null}
      <h2 className={`${eyebrow ? 'mt-2' : ''} text-2xl font-semibold text-gray-900`}>{title}</h2>
      {description ? (
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">{description}</p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  )
}
