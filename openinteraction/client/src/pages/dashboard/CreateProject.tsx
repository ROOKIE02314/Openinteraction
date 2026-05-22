import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '../../components/dashboard-layout/DashboardLayout';
import SurfaceCard from '../../components/surface/SurfaceCard';
import { createProject, createInterview } from '../../api/client';
import templatesData from '../../data/templates.json';
import { QRCodeSVG } from 'qrcode.react';
import './create-project.css';

interface Topic {
  id: string;
  description: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  topics: Topic[];
}

interface Category {
  id: string;
  name: string;
  templates: Template[];
}

interface ShareLink {
  link: string;
  token: string;
  createdAt: Date;
}

const { categories } = templatesData as { categories: Category[] };

const STEPS = ['选择模板', '产品信息', '编辑话题', '生成链接'];

function CreateProject() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Step 0 state
  const [, setSelectedCategory] = useState<Category | null>(null);
  const [, setSelectedTemplate] = useState<Template | null>(null);

  // Step 1 state
  const [productName, setProductName] = useState('');
  const [productContext, setProductContext] = useState('');

  // Step 2 state
  const [topics, setTopics] = useState<Topic[]>([]);

  // Step 3 state
  const [projectId, setProjectId] = useState<string | null>(null);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectTemplate = (category: Category, template: Template) => {
    setSelectedCategory(category);
    setSelectedTemplate(template);
    setTopics([...template.topics]);
    setStep(1);
  };

  const handleNextFromInfo = () => {
    if (!productName.trim()) return;
    setStep(2);
  };

  const handleCreateProject = async () => {
    if (!productName.trim() || topics.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const project = await createProject({
        name: productName.trim(),
        product_context: productContext.trim(),
        core_topics: topics,
      });
      setProjectId(project.id);
      const interview = await createInterview(project.id);
      setShareLinks([{
        link: interview.share_link,
        token: interview.share_token,
        createdAt: new Date(),
      }]);
      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '创建失败，请重试');
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!projectId) return;
    try {
      const interview = await createInterview(projectId);
      setShareLinks(prev => [...prev, {
        link: interview.share_link,
        token: interview.share_token,
        createdAt: new Date(),
      }]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '生成链接失败');
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
  };

  const handleTopicChange = (index: number, field: keyof Topic, value: string) => {
    setTopics(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  const handleRemoveTopic = (index: number) => {
    setTopics(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddTopic = () => {
    setTopics(prev => [...prev, { id: '', description: '' }]);
  };

  return (
    <DashboardLayout breadcrumb={<Link to="/dashboard">研究项目</Link>}>
      <div className="cp-steps">
        {STEPS.map((label, i) => (
          <div key={label} className={`cp-step ${i === step ? 'cp-step--active' : ''} ${i < step ? 'cp-step--done' : ''}`}>
            <span className="cp-step-num">{i + 1}</span>
            <span className="cp-step-label">{label}</span>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="cp-content">
          <h1 className="cp-title">选择访谈模板</h1>
          {categories.map(cat => (
            <div key={cat.id} className="cp-category">
              <h2 className="cp-category-name">{cat.name}</h2>
              <div className="cp-template-grid">
                {cat.templates.map(tpl => (
                  <SurfaceCard key={tpl.id} className="cp-template-card">
                    <h3 className="cp-template-name">{tpl.name}</h3>
                    <p className="cp-template-desc">{tpl.description}</p>
                    <p className="cp-template-count">{tpl.topics.length} 个话题</p>
                    <button
                      className="cp-btn cp-btn--select"
                      onClick={() => handleSelectTemplate(cat, tpl)}
                    >
                      选择此模板
                    </button>
                  </SurfaceCard>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="cp-content">
          <h1 className="cp-title">填写产品信息</h1>
          <SurfaceCard className="cp-form-card">
            <label className="cp-label">
              产品名称 <span className="cp-required">*</span>
            </label>
            <input
              className="cp-input"
              type="text"
              placeholder="例如：淘宝、微信、抖音"
              value={productName}
              onChange={e => setProductName(e.target.value)}
            />
            <label className="cp-label">
              产品简介 <span className="cp-optional">选填</span>
            </label>
            <textarea
              className="cp-textarea"
              placeholder="一句话描述这个产品是什么"
              value={productContext}
              onChange={e => setProductContext(e.target.value)}
              rows={3}
            />
            <div className="cp-form-actions">
              <button className="cp-btn cp-btn--back" onClick={() => setStep(0)}>上一步</button>
              <button
                className="cp-btn cp-btn--next"
                onClick={handleNextFromInfo}
                disabled={!productName.trim()}
              >
                下一步
              </button>
            </div>
          </SurfaceCard>
        </div>
      )}

      {step === 2 && (
        <div className="cp-content">
          <h1 className="cp-title">编辑话题</h1>
          <SurfaceCard className="cp-form-card">
            {topics.map((topic, i) => (
              <div key={i} className="cp-topic-row">
                <input
                  className="cp-input cp-topic-id"
                  type="text"
                  placeholder="话题ID"
                  value={topic.id}
                  onChange={e => handleTopicChange(i, 'id', e.target.value)}
                />
                <input
                  className="cp-input cp-topic-desc"
                  type="text"
                  placeholder="话题描述"
                  value={topic.description}
                  onChange={e => handleTopicChange(i, 'description', e.target.value)}
                />
                <button
                  className="cp-btn cp-btn--remove"
                  onClick={() => handleRemoveTopic(i)}
                  title="删除话题"
                >
                  &times;
                </button>
              </div>
            ))}
            <button className="cp-btn cp-btn--add" onClick={handleAddTopic}>
              + 添加话题
            </button>
            {error && <p className="cp-error" role="alert">{error}</p>}
            <div className="cp-form-actions">
              <button className="cp-btn cp-btn--back" onClick={() => setStep(1)}>上一步</button>
              <button
                className="cp-btn cp-btn--create"
                onClick={handleCreateProject}
                disabled={creating || topics.length === 0 || !topics.some(t => t.id.trim() && t.description.trim())}
              >
                {creating ? '创建中…' : '创建项目'}
              </button>
            </div>
          </SurfaceCard>
        </div>
      )}

      {step === 3 && (
        <div className="cp-content">
          <h1 className="cp-title">项目已创建</h1>
          <p className="cp-subtitle">「{productName}」的访谈链接如下，分享给受访者即可开始收集反馈。</p>

          <div className="cp-links-list">
            {shareLinks.map((sl, i) => (
              <SurfaceCard key={sl.token} className="cp-link-card">
                <div className="cp-link-info">
                  <p className="cp-link-label">链接 {i + 1}</p>
                  <p className="cp-link-url">{sl.link}</p>
                  <button className="cp-btn cp-btn--copy" onClick={() => handleCopyLink(sl.link)}>
                    复制链接
                  </button>
                </div>
                <div className="cp-link-qr">
                  <QRCodeSVG value={sl.link} size={120} />
                </div>
              </SurfaceCard>
            ))}
          </div>

          <div className="cp-final-actions">
            <button className="cp-btn cp-btn--next" onClick={handleGenerateLink}>
              再生成一个链接
            </button>
            <button className="cp-btn cp-btn--back" onClick={() => navigate('/dashboard')}>
              返回项目列表
            </button>
            {projectId && (
              <button className="cp-btn cp-btn--next" onClick={() => navigate(`/dashboard/projects/${projectId}`)}>
                进入项目详情
              </button>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default CreateProject;
