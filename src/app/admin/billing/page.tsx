'use client';

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiPlus, FiTrash2, FiCheck, FiX, FiLoader } from 'react-icons/fi';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  StyledSelect,
} from '@/components/ui';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import {
  superadminApiService,
  type PricingPlan,
  type CreatePricingPlanData,
} from '@/lib/api/services/superadmin.service';
import { formatCents } from '@/lib/utils/formatting';

const PLAN_TYPE_LABELS: Record<string, string> = {
  number: 'Phone Number',
  sms_service: 'SMS Service',
  platform_fee: 'Platform Fee',
  setup_fee: 'Setup Fee',
};

const PlanRow = React.memo(function PlanRow({
  plan,
  onDelete,
}: {
  plan: PricingPlan;
  onDelete: (plan: PricingPlan) => void;
}) {
  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
      <td className="py-3 px-4 font-medium text-[var(--foreground)]">{plan.name}</td>
      <td className="py-3 px-4 text-[var(--muted-foreground)]">
        {PLAN_TYPE_LABELS[plan.planType] || plan.planType}
      </td>
      <td className="py-3 px-4 text-[var(--muted-foreground)]">{plan.countryCode || '-'}</td>
      <td className="py-3 px-4 text-[var(--foreground)] text-right font-mono">
        {formatCents(plan.monthlyPriceCents)}
      </td>
      <td className="py-3 px-4 text-[var(--foreground)] text-right font-mono">
        {formatCents(plan.upfrontPriceCents)}
      </td>
      <td className="py-3 px-4 text-center">
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
            plan.isActive
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
          }`}
        >
          {plan.isActive ? <FiCheck className="w-3 h-3" /> : <FiX className="w-3 h-3" />}
          {plan.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Deactivate ${plan.name}`}
          onClick={() => onDelete(plan)}
        >
          <FiTrash2 className="w-4 h-4 text-[var(--danger)]" />
        </Button>
      </td>
    </tr>
  );
});

export default function PricingPlansPage() {
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deletePlan, setDeletePlan] = useState<PricingPlan | null>(null);
  const [form, setForm] = useState<CreatePricingPlanData>({
    planType: 'number',
    countryCode: 'US',
    numberType: 'local',
    name: '',
    monthlyPriceCents: 0,
    upfrontPriceCents: 0,
  });

  const {
    data: plans,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['superadmin', 'pricing'],
    queryFn: () => superadminApiService.getPricingPlans(),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePricingPlanData) => superadminApiService.createPricingPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'pricing'] });
      setCreateModalOpen(false);
      setForm({
        planType: 'number',
        countryCode: 'US',
        numberType: 'local',
        name: '',
        monthlyPriceCents: 0,
        upfrontPriceCents: 0,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => superadminApiService.deletePricingPlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'pricing'] });
      setDeletePlan(null);
    },
  });

  const handleDeleteClick = useCallback((plan: PricingPlan) => setDeletePlan(plan), []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletePlan) return;
    await deleteMutation.mutateAsync(deletePlan.id);
  }, [deletePlan, deleteMutation]);

  const planList = plans?.data ?? [];

  if (isError)
    return (
      <div className="p-8 text-center text-[var(--danger)]">
        Failed to load pricing plans. Please try again.
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Pricing Plans</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Manage pricing for phone numbers, SMS, and platform fees
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)}>
          <FiPlus className="w-4 h-4" /> Create Plan
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            All Plans
            <span className="text-sm font-normal text-[var(--muted-foreground)] ml-2">
              ({planList.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="w-8 h-8 animate-spin text-[var(--foreground)]" />
            </div>
          ) : planList.length === 0 ? (
            <div className="text-center py-12 text-[var(--muted-foreground)]">
              No pricing plans found. Create one to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Name
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Type
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Country
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Monthly
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Upfront
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {planList.map((plan) => (
                    <PlanRow key={plan.id} plan={plan} onDelete={handleDeleteClick} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Pricing Plan"
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(form);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="planType"
                className="block text-sm font-medium text-[var(--foreground)] mb-1"
              >
                Type
              </label>
              <StyledSelect
                id="planType"
                value={form.planType}
                onChange={(v) =>
                  setForm({
                    ...form,
                    planType: v as CreatePricingPlanData['planType'],
                  })
                }
                className="bg-[var(--card)]"
              >
                <option value="number">Phone Number</option>
                <option value="sms_service">SMS Service</option>
                <option value="platform_fee">Platform Fee</option>
                <option value="setup_fee">Setup Fee</option>
              </StyledSelect>
            </div>
            <div>
              <label
                htmlFor="planName"
                className="block text-sm font-medium text-[var(--foreground)] mb-1"
              >
                Name *
              </label>
              <Input
                id="planName"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. US Local Number"
                required
              />
            </div>
            <div>
              <label
                htmlFor="monthlyPrice"
                className="block text-sm font-medium text-[var(--foreground)] mb-1"
              >
                Monthly (cents)
              </label>
              <Input
                id="monthlyPrice"
                type="number"
                value={form.monthlyPriceCents}
                onChange={(e) => setForm({ ...form, monthlyPriceCents: Number(e.target.value) })}
                min={0}
              />
            </div>
            <div>
              <label
                htmlFor="upfrontPrice"
                className="block text-sm font-medium text-[var(--foreground)] mb-1"
              >
                Upfront (cents)
              </label>
              <Input
                id="upfrontPrice"
                type="number"
                value={form.upfrontPriceCents}
                onChange={(e) => setForm({ ...form, upfrontPriceCents: Number(e.target.value) })}
                min={0}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border)]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateModalOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || !form.name}
              loading={createMutation.isPending}
            >
              Create Plan
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deletePlan !== null}
        onClose={() => setDeletePlan(null)}
        onConfirm={handleDeleteConfirm}
        title="Deactivate Pricing Plan"
        message={`Are you sure you want to deactivate "${deletePlan?.name}"? This will prevent it from being used in new orders.`}
        confirmText="Deactivate"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
