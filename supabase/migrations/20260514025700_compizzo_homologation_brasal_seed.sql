-- Compizzo homologation seed.
-- Creates the test tenant and the first Brasal work package using data extracted
-- from the Compizzo onboarding documents. Idempotent by organization slug,
-- project code and construction site code.

DO $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_project_id uuid;
  v_site_id uuid;
  v_start_date date := DATE '2026-05-01';
  v_end_date date := DATE '2026-07-30';
  v_project_payload jsonb;
  v_site_payload jsonb;
BEGIN
  SELECT u.id
    INTO v_user_id
  FROM auth.users u
  WHERE lower(u.email) = 'joaoneryflu@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Global admin joaoneryflu@gmail.com not found. Skipping Compizzo homologation seed.';
    RETURN;
  END IF;

  INSERT INTO public.organizations (
    name,
    slug,
    plan,
    max_users,
    max_projects,
    owner_id,
    environment,
    settings
  )
  VALUES (
    'Compizzo - Homologação',
    'compizzo-homologacao',
    'enterprise',
    50,
    25,
    v_user_id,
    'homologation',
    jsonb_build_object(
      'approval_matrix', jsonb_build_object(
        'delete_fvs', 'diretor',
        'update_fvs_closed', 'gerente',
        'delete_rdo', 'gerente',
        'update_rdo_closed', 'gerente',
        'approve_budget', 'diretor',
        'delete_project', 'owner',
        'delete_organization', 'owner'
      ),
      'mfa_required_roles', jsonb_build_array('owner', 'diretor'),
      'soft_delete_days', 30,
      'source', 'quick_adaptation',
      'client', 'Compizzo',
      'homologation_label', 'Teste'
    )
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    plan = EXCLUDED.plan,
    max_users = EXCLUDED.max_users,
    max_projects = EXCLUDED.max_projects,
    owner_id = EXCLUDED.owner_id,
    environment = 'homologation',
    settings = public.organizations.settings || EXCLUDED.settings,
    deleted_at = NULL,
    updated_at = now()
  RETURNING id INTO v_org_id;

  IF EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE organization_id = v_org_id
      AND user_id = v_user_id
      AND deleted_at IS NULL
  ) THEN
    UPDATE public.memberships
       SET role = 'owner',
           status = 'active',
           joined_at = COALESCE(joined_at, now()),
           blocked_at = NULL,
           blocked_by = NULL,
           block_reason = NULL,
           updated_at = now()
     WHERE organization_id = v_org_id
       AND user_id = v_user_id
       AND deleted_at IS NULL;
  ELSE
    INSERT INTO public.memberships (
      organization_id,
      user_id,
      role,
      status,
      joined_at,
      created_at,
      updated_at
    )
    VALUES (
      v_org_id,
      v_user_id,
      'owner',
      'active',
      now(),
      now(),
      now()
    );
  END IF;

  v_project_payload := jsonb_build_object(
    'id', gen_random_uuid(),
    'code', 'BRASAL-INC24',
    'name', 'Brasal Inc24',
    'owner', 'Compizzo',
    'manager', 'VINICIUS',
    'description', 'Implantação de piso epóxi, paredes e demarcações para Brasal em Brasília - DF.',
    'status', 'planning',
    'startDate', v_start_date::text,
    'endDate', v_end_date::text,
    'address', 'Brasília - DF',
    'contractNumber', '109.2026',
    'clientName', 'Brasal',
    'projectManager', 'VINICIUS',
    'riskLevel', 'medium',
    'priority', 'high',
    'planningPhases', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'name', 'Adaptação dos documentos-base', 'status', 'in_progress', 'progress', 45, 'startDate', v_start_date::text, 'endDate', '2026-05-10', 'responsible', 'VINICIUS', 'notes', 'Validar proposta final, contrato e critério de medição aprovado.'),
      jsonb_build_object('id', gen_random_uuid(), 'name', 'Quantitativos e orçamento', 'status', 'in_progress', 'progress', 70, 'startDate', v_start_date::text, 'endDate', '2026-05-15', 'responsible', 'VINICIUS', 'notes', 'Base: Levantamento Compizzo Modelo.xlsx.'),
      jsonb_build_object('id', gen_random_uuid(), 'name', 'Suprimentos e mobilização', 'status', 'not_started', 'progress', 0, 'startDate', '2026-05-16', 'endDate', '2026-05-25', 'responsible', 'Compizzo', 'notes', 'Confirmar insumos, fretes, equipamentos e equipe.')
    ),
    'executionPhases', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'name', 'Preparação e lixamento', 'status', 'not_started', 'progress', 0, 'startDate', '2026-05-26', 'endDate', '2026-06-10', 'responsible', 'Equipe de campo'),
      jsonb_build_object('id', gen_random_uuid(), 'name', 'Aplicação epóxi e pintura', 'status', 'not_started', 'progress', 0, 'startDate', '2026-06-11', 'endDate', '2026-07-10', 'responsible', 'Equipe de campo'),
      jsonb_build_object('id', gen_random_uuid(), 'name', 'Demarcação e aceite técnico', 'status', 'not_started', 'progress', 0, 'startDate', '2026-07-11', 'endDate', v_end_date::text, 'responsible', 'VINICIUS')
    ),
    'budgetLines', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'type', 'labor', 'description', 'Mão de obra prevista', 'budgeted', 30812.07, 'projected', 30812.07, 'spent', 0),
      jsonb_build_object('id', gen_random_uuid(), 'type', 'materials', 'description', 'Insumos', 'budgeted', 50527.00, 'projected', 50527.00, 'spent', 0),
      jsonb_build_object('id', gen_random_uuid(), 'type', 'equipment', 'description', 'Aluguel de equipamentos', 'budgeted', 15000.00, 'projected', 15000.00, 'spent', 0),
      jsonb_build_object('id', gen_random_uuid(), 'type', 'overhead', 'description', 'Frete e outros custos', 'budgeted', 46750.00, 'projected', 46750.00, 'spent', 0)
    ),
    'demands', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'label', 'Piso estacionamento', 'quantity', 5902, 'unit', 'm²', 'estimatedCost', 0),
      jsonb_build_object('id', gen_random_uuid(), 'label', 'Paredes Car Wash / Bikewash / Ferramentaria', 'quantity', 228.55, 'unit', 'm²', 'estimatedCost', 0),
      jsonb_build_object('id', gen_random_uuid(), 'label', 'Demarcação de vagas', 'quantity', 3140, 'unit', 'ml', 'estimatedCost', 0),
      jsonb_build_object('id', gen_random_uuid(), 'label', 'Seca piso / metal', 'quantity', 344, 'unit', 'm²', 'estimatedCost', 0)
    ),
    'documents', jsonb_build_array(),
    'environment', 'homologation',
    'source', 'quick_adaptation',
    'quickAdaptation', jsonb_build_object(
      'available', jsonb_build_array(
        'Identificação da obra Brasal Inc24',
        'Contratante Brasal',
        'Cidade/UF Brasília - DF',
        'Técnico responsável VINICIUS',
        'Orçamento 109.2026',
        'Escopo piso epóxi + paredes + demarcações',
        'Sistema epóxi alta espessura',
        'Prazo estimado de 90 dias',
        'Quantitativos principais',
        'Equipe e custos de mão de obra',
        'Faturamento, despesas, impostos e saldo'
      ),
      'missing', jsonb_build_array(
        'Contrato final assinado da Brasal',
        'Endereço completo e frentes de serviço',
        'Cronograma executivo aprovado',
        'Fotos atuais do local',
        'Condições do substrato',
        'Critérios finais de aceite e medição aprovados em contrato',
        'Notas fiscais e fornecedores definitivos'
      ),
      'rdoControl', jsonb_build_array(
        'Registrar equipe diária, frentes, serviços executados, fotos e ocorrências no RDO.',
        'Lançar quantidades de piso em m², demarcação em ml e evidências fotográficas por frente.',
        'Referenciar custos e suprimentos no RDO apenas como observação operacional; controle financeiro fica em Suprimentos/Gestão 360/EVM.'
      )
    )
  );

  INSERT INTO public.projects (
    id,
    organization_id,
    code,
    name,
    status,
    start_date,
    end_date,
    payload,
    created_by
  )
  VALUES (
    (v_project_payload->>'id')::uuid,
    v_org_id,
    'BRASAL-INC24',
    'Brasal Inc24',
    'planning',
    v_start_date,
    v_end_date,
    v_project_payload,
    v_user_id
  )
  ON CONFLICT (organization_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    payload = EXCLUDED.payload || jsonb_build_object('id', public.projects.id),
    deleted_at = NULL,
    updated_at = now()
  RETURNING id INTO v_project_id;

  v_site_payload := jsonb_build_object(
    'id', gen_random_uuid(),
    'projectId', v_project_id,
    'code', 'OBR-BRASAL-INC24',
    'name', 'Brasal Inc24',
    'company', 'Compizzo',
    'owner', 'Brasal',
    'manager', 'VINICIUS',
    'description', 'Obra de piso epóxi alta espessura, paredes e demarcações iniciada em homologação.',
    'status', 'planning',
    'street', '',
    'number', '',
    'district', '',
    'city', 'Brasília',
    'state', 'DF',
    'cep', '',
    'buildingType', 'Comercial',
    'totalArea', 6130.55,
    'floors', 1,
    'serviceScope', 'piso epóxi + paredes + demarcações',
    'startDate', v_start_date::text,
    'expectedEnd', v_end_date::text,
    'lat', NULL,
    'lng', NULL,
    'risks', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'title', 'Contrato final pendente', 'description', 'Os documentos recebidos são base/referência; falta contrato final Brasal aprovado.', 'level', 'medium', 'status', 'identified', 'identifiedAt', now()::text),
      jsonb_build_object('id', gen_random_uuid(), 'title', 'Critério de medição pendente', 'description', 'Percentuais por etapa devem ser confirmados em contrato para evitar glosas.', 'level', 'high', 'status', 'identified', 'identifiedAt', now()::text)
    ),
    'budgetLines', jsonb_build_array(
      jsonb_build_object('label', 'Faturamento total previsto', 'amount', 489586.06, 'projected', 489586.06),
      jsonb_build_object('label', 'Despesas totais previstas', 'amount', 143089.07, 'projected', 143089.07),
      jsonb_build_object('label', 'Saldo líquido de referência', 'amount', 34624.23, 'projected', 34624.23)
    ),
    'planningMilestones', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'label', 'Cadastro homologação', 'date', now()::date::text, 'status', 'done'),
      jsonb_build_object('id', gen_random_uuid(), 'label', 'Validação contrato Brasal', 'date', '2026-05-10', 'status', 'active'),
      jsonb_build_object('id', gen_random_uuid(), 'label', 'Plano inicial de RDO e medição', 'date', '2026-05-15', 'status', 'pending')
    ),
    'executionMilestones', jsonb_build_array(),
    'environment', 'homologation',
    'source', 'quick_adaptation',
    'documentMapping', jsonb_build_object(
      'Levantamento Compizzo Modelo.xlsx', jsonb_build_array('Projetos/Torre', 'Quantitativos', 'Mão de Obra', 'Suprimentos', 'Gestão 360/EVM'),
      '149.2026 - Geely - Atualizada.pdf', jsonb_build_array('Modelo de proposta/referência', 'Não usar como contrato final da Brasal'),
      'Imagens', jsonb_build_array('RDO/Qualidade para evidências', 'Suprimentos/Financeiro para gastos mensais', 'Medição/Mão de Obra para percentuais e custos por etapa')
    ),
    'quantitativos', jsonb_build_array(
      jsonb_build_object('item', 'Piso estacionamento', 'quantidade', 5902, 'unidade', 'm²'),
      jsonb_build_object('item', 'Paredes', 'quantidade', 228.55, 'unidade', 'm²'),
      jsonb_build_object('item', 'Demarcação', 'quantidade', 3140, 'unidade', 'ml'),
      jsonb_build_object('item', 'Seca piso / metal', 'quantidade', 344, 'unidade', 'm²')
    ),
    'maoDeObra', jsonb_build_array(
      jsonb_build_object('funcao', 'Meio oficial', 'quantidade', 4, 'dias', 60, 'custo', 12226.63),
      jsonb_build_object('funcao', 'Pintor', 'quantidade', 3, 'dias', 60, 'custo', 11397.95),
      jsonb_build_object('funcao', 'Encarregado', 'quantidade', 1, 'dias', 60, 'custo', 3364.22),
      jsonb_build_object('funcao', 'Engenheiro', 'quantidade', 1, 'dias', 60, 'custo', 3823.26)
    )
  );

  SELECT id
    INTO v_site_id
  FROM public.construction_sites
  WHERE organization_id = v_org_id
    AND code = 'OBR-BRASAL-INC24'
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_site_id IS NULL THEN
    INSERT INTO public.construction_sites (
      id,
      organization_id,
      project_id,
      code,
      name,
      status,
      city,
      state,
      start_date,
      expected_end,
      payload,
      created_by
    )
    VALUES (
      (v_site_payload->>'id')::uuid,
      v_org_id,
      v_project_id,
      'OBR-BRASAL-INC24',
      'Brasal Inc24',
      'planning',
      'Brasília',
      'DF',
      v_start_date,
      v_end_date,
      v_site_payload,
      v_user_id
    )
    RETURNING id INTO v_site_id;
  ELSE
    UPDATE public.construction_sites
       SET project_id = v_project_id,
           name = 'Brasal Inc24',
           status = 'planning',
           city = 'Brasília',
           state = 'DF',
           start_date = v_start_date,
           expected_end = v_end_date,
           payload = v_site_payload || jsonb_build_object('id', v_site_id),
           deleted_at = NULL,
           updated_at = now()
     WHERE id = v_site_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.quick_adaptation_sessions
    WHERE organization_id = v_org_id
      AND title = 'Compizzo - Brasal Inc24'
      AND deleted_at IS NULL
  ) THEN
    INSERT INTO public.quick_adaptation_sessions (
      organization_id,
      title,
      status,
      source_summary,
      extracted_payload,
      checklist,
      linked_project_id,
      created_by
    )
    VALUES (
      v_org_id,
      'Compizzo - Brasal Inc24',
      'reviewed',
      jsonb_build_object(
        'documents', jsonb_build_array(
          'Levantamento Compizzo Modelo.xlsx',
          '149.2026 - Geely - Atualizada.pdf',
          'Fotos e imagens de referência'
        ),
        'environment', 'homologation',
        'source', 'quick_adaptation'
      ),
      jsonb_build_object(
        'obra', 'Brasal Inc24',
        'contratante', 'Brasal',
        'cidadeUf', 'Brasília - DF',
        'tecnico', 'VINICIUS',
        'orcamento', '109.2026',
        'escopo', 'piso epóxi + paredes + demarcações',
        'sistema', 'epóxi alta espessura',
        'prazoDias', 90,
        'quantitativos', jsonb_build_object('pisoM2', 5902, 'paredesM2', 228.55, 'demarcacaoMl', 3140, 'secaPisoMetalM2', 344),
        'maoDeObraTotal', 30812.07,
        'faturamentoPrevisto', 489586.06,
        'despesasPrevistas', 143089.07
      ),
      jsonb_build_object(
        'found', jsonb_build_array('identificação', 'escopo', 'quantitativos', 'mão de obra', 'orçamento', 'despesas', 'percentuais de medição de referência'),
        'missing', jsonb_build_array('contrato final', 'endereço completo', 'cronograma aprovado', 'fotos atuais', 'condição do substrato', 'critério final de aceite', 'fornecedores e notas definitivas'),
        'rdo', jsonb_build_array('lançar frentes, equipe, serviços executados, fotos, ocorrências, pendências de liberação e evidências por dia')
      ),
      v_project_id,
      v_user_id
    );
  END IF;
END $$;
