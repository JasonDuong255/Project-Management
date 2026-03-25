import { SectionHeader } from '../components/SectionHeader'
import { StatusPill } from '../components/StatusPill'
import { useAppData } from '../context/AppContext'

export function AdminCatalogPage() {
  const { catalogs } = useAppData()

  const groups = [
    ['Trạng thái dự án', catalogs.projectStatuses],
    ['Health status', catalogs.healthStatuses],
    ['Trạng thái công việc', catalogs.taskStatuses],
    ['Mức độ rủi ro', catalogs.riskLevels],
    ['Loại tài liệu', catalogs.documentCategories],
    ['Đơn vị', catalogs.departments],
  ] as const

  return (
    <div className="page-grid">
      <SectionHeader
        title="Danh mục hệ thống"
        description="Khung quản trị LOV để sau này nối CRUD đầy đủ"
      />

      <section className="catalog-grid">
        {groups.map(([title, items]) => (
          <article key={title} className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Catalog group</span>
                <h3>{title}</h3>
              </div>
              <StatusPill label={`${items.length} giá trị`} tone="info" />
            </div>

            <div className="stack-list">
              {items.map((item) => (
                <div key={item.value} className="list-row">
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
