import { useState, useEffect } from "react"; 
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card } from "./ui/card";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, Archive, Plus, Lock, LockOpen } from "lucide-react";
import { Switch } from "./ui/switch";

interface Travel {
  id: string;
  startDate: string;
  endDate: string;
  slots: number;
  destination: string;
  dailyAllowance?: number | null;
  dailyRate?: number | null;
  halfLastDay: boolean;
  volunteers: string[];          // Todos os que se candidataram
  selectedVolunteers?: string[]; // Somente os que viajarão de fato
  archived: boolean;
  isLocked?: boolean;
}

export const TravelManagement = () => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [slots, setSlots] = useState("");
  const [destination, setDestination] = useState("");
  const [dailyAllowance, setDailyAllowance] = useState("");
  const [dailyRate, setDailyRate] = useState("");
  const [halfLastDay, setHalfLastDay] = useState(false);
  const [travels, setTravels] = useState<Travel[]>([]);
  const [volunteerCounts, setVolunteerCounts] = useState<{ [key: string]: number }>({});
  const [diaryCounts, setDiaryCounts] = useState<{ [key: string]: number }>({});
  const [editingTravel, setEditingTravel] = useState<any>(null);
  const [expandedTravels, setExpandedTravels] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lockedTravels, setLockedTravels] = useState<string[]>([]);
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user.userType === "admin";

  // ---------------------------------------------------
  // 1) EFEITO PARA CALCULAR DIÁRIAS E QUANTIDADE DE VIAGENS
  // ---------------------------------------------------
  useEffect(() => {
    const travelsRef = collection(db, "travels");
    const q = query(travelsRef);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const counts: { [key: string]: number } = {};
      const diaryCount: { [key: string]: number } = {};
      const today = new Date();

      snapshot.docs.forEach((doc) => {
        const travel = doc.data() as DocumentData;
        const travelStart = new Date(travel.startDate + "T00:00:00");
        const travelEnd = new Date(travel.endDate + "T00:00:00");

        // Vamos contar diárias só para quem estiver em selectedVolunteers
        // E somente se a viagem estiver bloqueada (ou em andamento / encerrada)
        if (
          travel.selectedVolunteers &&
          travel.selectedVolunteers.length > 0 &&
          (
            (today < travelStart && travel.isLocked) ||
            (today >= travelStart && today <= travelEnd) ||
            (today > travelEnd)
          )
        ) {
          travel.selectedVolunteers.forEach((volunteer: string) => {
            // Conta quantas viagens essa pessoa já participou
            counts[volunteer] = (counts[volunteer] || 0) + 1;
            
            // Calcula diárias
            const days = differenceInDays(travelEnd, travelStart) + 1;
            const diaryDays = travel.halfLastDay ? days - 0.5 : days;
            diaryCount[volunteer] = (diaryCount[volunteer] || 0) + diaryDays;
          });
        }
      });

      setVolunteerCounts(counts);
      setDiaryCounts(diaryCount);
    });

    return () => unsubscribe();
  }, []);

  // ---------------------------------------------------
  // 2) EFEITO PARA CARREGAR VIAGENS
  // ---------------------------------------------------
  useEffect(() => {
    const q = query(collection(db, "travels"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const travelsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Travel[];
      setTravels(travelsData);
      
      const lockedTravelIds = travelsData
        .filter(travel => travel.isLocked)
        .map(travel => travel.id);
      setLockedTravels(lockedTravelIds);
    });

    return () => unsubscribe();
  }, []);

  // ---------------------------------------------------
  // 3) CRIAR OU EDITAR VIAGEM
  // ---------------------------------------------------
  const handleCreateTravel = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingTravel) {
        const travelRef = doc(db, "travels", editingTravel.id);
        await updateDoc(travelRef, {
          startDate,
          endDate,
          slots: Number(slots),
          destination,
          dailyAllowance: dailyAllowance ? Number(dailyAllowance) : null,
          dailyRate: dailyRate ? Number(dailyRate) : null,
          halfLastDay,
          updatedAt: new Date(),
          archived: editingTravel.archived || false,
        });

        toast({
          title: "Sucesso",
          description: "Viagem atualizada com sucesso!",
        });
        setEditingTravel(null);
      } else {
        await addDoc(collection(db, "travels"), {
          startDate,
          endDate,
          slots: Number(slots),
          destination,
          dailyAllowance: dailyAllowance ? Number(dailyAllowance) : null,
          dailyRate: dailyRate ? Number(dailyRate) : null,
          halfLastDay,
          createdAt: new Date(),
          volunteers: [],
          selectedVolunteers: [], // Inicia vazio
          archived: false,
          isLocked: false,
        });

        toast({
          title: "Sucesso",
          description: "Viagem criada com sucesso!",
        });
      }

      setStartDate("");
      setEndDate("");
      setSlots("");
      setDestination("");
      setDailyAllowance("");
      setDailyRate("");
      setHalfLastDay(false);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error creating/updating travel:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar viagem.",
        variant: "destructive",
      });
    }
  };

  const handleEditTravel = (travel: Travel) => {
    setEditingTravel(travel);
    setStartDate(travel.startDate);
    setEndDate(travel.endDate);
    setSlots(String(travel.slots));
    setDestination(travel.destination);
    setDailyAllowance(String(travel.dailyAllowance || ""));
    setDailyRate(String(travel.dailyRate || ""));
    setHalfLastDay(travel.halfLastDay || false);
    setIsModalOpen(true);
  };

  // ---------------------------------------------------
  // 4) EXCLUIR VIAGEM
  // ---------------------------------------------------
  const handleDeleteTravel = async (travelId: string) => {
    try {
      await deleteDoc(doc(db, "travels", travelId));
      toast({
        title: "Sucesso",
        description: "Viagem excluída com sucesso!",
      });
    } catch (error) {
      console.error("Error deleting travel:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir viagem.",
        variant: "destructive",
      });
    }
  };

  // ---------------------------------------------------
  // 5) ARQUIVAR VIAGEM
  // ---------------------------------------------------
  const handleArchive = async (travelId: string, archived: boolean) => {
    try {
      const travelRef = doc(db, "travels", travelId);
      await updateDoc(travelRef, { archived });
      toast({
        title: "Sucesso",
        description: archived
          ? "Viagem arquivada com sucesso!"
          : "Viagem desarquivada com sucesso!",
      });
    } catch (error) {
      console.error("Error archiving travel:", error);
      toast({
        title: "Erro",
        description: "Erro ao arquivar a viagem.",
        variant: "destructive",
      });
    }
  };

  // ---------------------------------------------------
  // 6) VOLUNTARIAR-SE
  // ---------------------------------------------------
  const handleVolunteer = async (travelId: string) => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const volunteerInfo = `${user.rank} ${user.warName}`;

      if (!volunteerInfo) {
        toast({
          title: "Erro",
          description: "Usuário não encontrado. Por favor, faça login novamente.",
          variant: "destructive"
        });
        return;
      }

      const travelRef = doc(db, "travels", travelId);
      const travelSnap = await getDoc(travelRef);

      if (!travelSnap.exists()) {
        throw new Error("Viagem não encontrada");
      }

      const travelData = travelSnap.data() as Travel;
      const currentVolunteers = Array.isArray(travelData.volunteers)
        ? travelData.volunteers
        : [];

      // Se já estiver na lista, remove (desistir). Se não estiver, adiciona
      if (currentVolunteers.includes(volunteerInfo)) {
        const updatedVolunteers = currentVolunteers.filter(v => v !== volunteerInfo);
        await updateDoc(travelRef, {
          volunteers: updatedVolunteers,
        });

        toast({
          title: "Sucesso",
          description: "Você desistiu da viagem com sucesso.",
        });
        return;
      }

      const updatedVolunteers = [...currentVolunteers, volunteerInfo];
      await updateDoc(travelRef, {
        volunteers: updatedVolunteers,
      });

      toast({
        title: "Sucesso",
        description: "Você se candidatou com sucesso!",
      });
    } catch (error) {
      console.error("Error volunteering:", error);
      toast({
        title: "Erro",
        description: "Erro ao se candidatar.",
        variant: "destructive",
      });
    }
  };

  // ---------------------------------------------------
  // 7) TRAVAR / PROCESSAR DIÁRIA SEM EXCLUIR VOLUNTÁRIOS
  // ---------------------------------------------------
  const handleToggleLock = async (travelId: string) => {
    try {
      const travelRef = doc(db, "travels", travelId);
      const travelSnap = await getDoc(travelRef);

      if (!travelSnap.exists()) return;

      const travelData = travelSnap.data() as Travel;
      const isCurrentlyLocked = travelData.isLocked ?? false;

      if (!isCurrentlyLocked) {
        // Vamos travar a viagem agora (Processar diária).
        // 1. Pega todos os voluntários atuais
        const allVolunteers = travelData.volunteers ?? [];

        // 2. Transforma cada voluntário em objeto para poder ordenar
        const processed = allVolunteers.map((volunteer) => {
          const [rank] = volunteer.split(" ");
          return {
            fullName: volunteer,
            rank,
            diaryCount: diaryCounts[volunteer] || 0,
            rankWeight: getMilitaryRankWeight(rank),
          };
        });

        // 3. Ordena (menor quantidade de diárias primeiro; em caso de empate, maior patente primeiro)
        processed.sort((a, b) => {
          if (a.diaryCount !== b.diaryCount) {
            return a.diaryCount - b.diaryCount;
          }
          return b.rankWeight - a.rankWeight;
        });

        // 4. Fica só com a quantidade de vagas
        const selectedVolunteers = processed.slice(0, travelData.slots);

        // 5. Atualiza APENAS o campo selectedVolunteers (mantendo volunteers intocado)
        await updateDoc(travelRef, {
          isLocked: true,
          selectedVolunteers: selectedVolunteers.map((v) => v.fullName),
        });
      } else {
        // Desbloqueando a viagem (caso queiram reabrir vagas)
        // Limpa selectedVolunteers, mas mantém volunteers
        await updateDoc(travelRef, {
          isLocked: false,
          selectedVolunteers: [],
        });
      }

      toast({
        title: "Sucesso",
        description: !isCurrentlyLocked
          ? "Viagem bloqueada e diárias processadas!"
          : "Viagem reaberta!",
      });
    } catch (error) {
      console.error("Error toggling lock:", error);
      toast({
        title: "Erro",
        description: "Erro ao alterar o status da viagem.",
        variant: "destructive",
      });
    }
  };

  // ---------------------------------------------------
  // 8) PESO DE PATENTES
  // ---------------------------------------------------
  const getMilitaryRankWeight = (rank: string): number => {
    const rankWeights: { [key: string]: number } = {
      "Cel PM": 12,
      "Ten Cel PM": 11,
      "Maj PM": 10,
      "Cap PM": 9,
      "1° Ten PM": 8,
      "2° Ten PM": 7,
      "Sub Ten PM": 6,
      "1° Sgt PM": 5,
      "2° Sgt PM": 4,
      "3° Sgt PM": 3,
      "Cb PM": 2,
      "Sd PM": 1,
      "Estágio": 0
    };
    
    return rankWeights[rank] || 0;
  };

  // ---------------------------------------------------
  // 9) FUNÇÕES DE FORMATAÇÃO DE EXIBIÇÃO
  // ---------------------------------------------------
  const formattedTravelCount = (count: number) => {
    return count === 1 ? "1 viagem" : `${count} viagens`;
  };

  const formattedDiaryCount = (count: number) => {
    const formattedCount = count.toLocaleString("pt-BR", {
      minimumFractionDigits: count % 1 !== 0 ? 1 : 0,
      maximumFractionDigits: 1,
    });
    return `${formattedCount} ${count === 1 ? 'diária' : 'diárias'}`;
  };

  // ---------------------------------------------------
  // 10) FUNÇÃO PARA MOSTRAR VOLUNTÁRIOS
  //     - Mantém TODOS que se inscreveram
  //     - Marca como selected quem está em selectedVolunteers
  // ---------------------------------------------------
  const sortVolunteers = (travel: Travel) => {
    if (!travel.volunteers?.length) return [];

    // Transforma cada voluntário em objeto
    const processedVolunteers = travel.volunteers.map(volunteer => {
      const [rank] = volunteer.split(' ');
      return {
        fullName: volunteer,
        rank,
        count: volunteerCounts[volunteer] || 0,   // qtd de viagens
        diaryCount: diaryCounts[volunteer] || 0,  // qtd de diárias
        rankWeight: getMilitaryRankWeight(rank),
        isSelected: travel.selectedVolunteers?.includes(volunteer) || false
      };
    });

    // Vamos ordenar de forma que os selecionados apareçam primeiro
    // e depois organizamos por diaryCount e rankWeight, só para coerência visual
    processedVolunteers.sort((a, b) => {
      // 1. Se um é selecionado e o outro não, o selecionado vem antes
      if (a.isSelected && !b.isSelected) return -1;
      if (!a.isSelected && b.isSelected) return 1;

      // 2. Se ambos são selecionados (ou ambos não), ordena por diaryCount
      if (a.diaryCount !== b.diaryCount) {
        return a.diaryCount - b.diaryCount;
      }
      // 3. Em caso de empate, maior patente primeiro
      return b.rankWeight - a.rankWeight;
    });

    return processedVolunteers;
  };

  // ---------------------------------------------------
  // 11) EXPANDIR/COLAPSAR CARTÕES
  // ---------------------------------------------------
  const toggleExpansion = (travelId: string) => {
    setExpandedTravels((prev) =>
      prev.includes(travelId)
        ? prev.filter((id) => id !== travelId)
        : [...prev, travelId]
    );
  };

  // ---------------------------------------------------
  // 12) RENDER
  // ---------------------------------------------------
  return (
    <div className="p-6 space-y-8 relative">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {travels
          .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
          .map((travel) => {
            const travelStart = new Date(travel.startDate + "T00:00:00");
            const travelEnd = new Date(travel.endDate + "T00:00:00");
            const today = new Date();
            const isLocked = travel.isLocked;

            let cardBg = "bg-white";
            let statusBadge = null;
            const rightPos = isAdmin ? "right-12" : "right-2";

            // Definir cor de fundo / status
            if (today < travelStart) {
              if (isLocked) {
                statusBadge = (
                  <div className={`absolute top-2 ${rightPos} bg-orange-500 text-white px-2 py-1 text-xs rounded`}>
                    Processando diária
                  </div>
                );
              } else {
                statusBadge = (
                  <div className={`absolute top-2 ${rightPos} bg-[#3B82F6] text-white px-2 py-1 text-xs rounded`}>
                    Em aberto
                  </div>
                );
              }
            } else if (today >= travelStart && today <= travelEnd) {
              cardBg = "bg-green-100";
              statusBadge = (
                <div className={`absolute top-2 ${rightPos} bg-green-500 text-white px-2 py-1 text-xs rounded`}>
                  Em transito
                </div>
              );
            } else if (today > travelEnd) {
              cardBg = "bg-gray-100";
              statusBadge = (
                <div className={`absolute top-2 ${rightPos} bg-gray-300 text-gray-700 px-2 py-1 text-xs rounded`}>
                  Encerrada
                </div>
              );
            }

            // Cálculo de diárias (exibição)
            const numDays = differenceInDays(travelEnd, travelStart) + 1;
            const count = travel.halfLastDay ? numDays - 0.5 : numDays;
            const formattedCount = count.toLocaleString("pt-BR", {
              minimumFractionDigits: count % 1 !== 0 ? 1 : 0,
              maximumFractionDigits: 1,
            });
            const totalCost = count * Number(travel.dailyRate);
            const diariasLine = travel.dailyRate
              ? `Diárias: ${formattedCount} (${totalCost.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })})`
              : `Diárias: ${formattedCount}`;

            // Conteúdo "fechado" (apenas título e data inicial)
            const minimalContent = (
              <div className="cursor-pointer" onClick={() => toggleExpansion(travel.id)}>
                <h3 className="text-xl font-semibold">{travel.destination}</h3>
                <p>Data Inicial: {travelStart.toLocaleDateString()}</p>
                <p>{diariasLine}</p>
              </div>
            );

            // Conteúdo completo (expandido)
            const fullContent = (
              <div>
                <div className="mb-2 cursor-pointer" onClick={() => toggleExpansion(travel.id)}>
                  <h3 className="text-xl font-semibold text-primary">{travel.destination}</h3>
                </div>
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  <p>Data Inicial: {travelStart.toLocaleDateString()}</p>
                  <p>Data Final: {travelEnd.toLocaleDateString()}</p>
                  <p>Vagas: {travel.slots}</p>
                  <p>{diariasLine}</p>

                  {travel.volunteers && travel.volunteers.length > 0 && (
                    <div className="pt-4 border-t border-gray-100">
                      <h4 className="font-medium text-sm text-gray-700 mb-2">Voluntário:</h4>
                      <ul className="space-y-1">
                        {sortVolunteers(travel).map((vol) => (
                          <li
                            key={vol.fullName}
                            className={`text-sm p-2 rounded flex justify-between items-center ${
                              vol.isSelected 
                                ? 'bg-green-100 border border-green-200'
                                : 'bg-gray-50 border border-gray-100'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              {vol.isSelected && (
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              )}
                              <span className={`${vol.isSelected ? 'font-medium' : ''}`}>
                                {vol.fullName}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className={`text-xs ${vol.isSelected ? 'text-green-700' : 'text-gray-500'}`}>
                                {formattedTravelCount(vol.count)}
                              </span>
                              <span className={`text-xs block ${vol.isSelected ? 'text-green-700' : 'text-gray-500'}`}>
                                {formattedDiaryCount(vol.diaryCount)}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                {/* Se a viagem ainda não começou, não está arquivada e não está travada, permitir (des)voluntariar */}
                {today < travelStart && !travel.archived && !isLocked && (
                  <div className="mt-4">
                    <Button
                      onClick={() => handleVolunteer(travel.id)}
                      className={`w-full ${
                        travel.volunteers?.includes(`${user.rank} ${user.warName}`)
                          ? "bg-red-500 hover:bg-red-600"
                          : "bg-[#3B82F6] hover:bg-[#2563eb]"
                      } text-white`}
                    >
                      {travel.volunteers?.includes(`${user.rank} ${user.warName}`)
                        ? "Desistir"
                        : "Quero ser Voluntário"}
                    </Button>
                  </div>
                )}
              </div>
            );

            return (
              <Card
                key={travel.id}
                className={`p-6 hover:shadow-xl transition-shadow relative ${cardBg} ${
                  travel.archived ? "cursor-pointer" : ""
                }`}
                onClick={travel.archived ? () => toggleExpansion(travel.id) : undefined}
                onDoubleClick={today > travelEnd ? () => toggleExpansion(travel.id) : undefined}
              >
                {statusBadge}
                
                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="absolute top-2 right-2 h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditTravel(travel)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => handleDeleteTravel(travel.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleArchive(travel.id, true)}>
                        <Archive className="mr-2 h-4 w-4" />
                        Arquivar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleLock(travel.id)}>
                        {isLocked ? (
                          <>
                            <LockOpen className="mr-2 h-4 w-4" />
                            Reabrir vagas
                          </>
                        ) : (
                          <>
                            <Lock className="mr-2 h-4 w-4" />
                            Processar diária
                          </>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <div className="space-y-4">
                  {travel.archived && !expandedTravels.includes(travel.id)
                    ? minimalContent
                    : fullContent}
                </div>
              </Card>
            );
          })}
      </div>

      {/* Modal de criação/edição de viagens */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <Card className="p-6 bg-white shadow-lg max-w-lg w-full relative">
            <button
              onClick={() => {
                setIsModalOpen(false);
                setEditingTravel(null);
                setStartDate("");
                setEndDate("");
                setSlots("");
                setDestination("");
                setDailyAllowance("");
                setDailyRate("");
                setHalfLastDay(false);
              }}
              className="absolute top-2 right-2 text-gray-600 hover:text-gray-800 text-xl"
            >
              &times;
            </button>
            <form onSubmit={handleCreateTravel} className="space-y-6">
              <h2 className="text-2xl font-semibold text-primary">
                {editingTravel ? "Editar Viagem" : "Criar Nova Viagem"}
              </h2>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="destination">Destino</Label>
                  <Input
                    id="destination"
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    required
                    placeholder="Digite o destino"
                    className="w-full"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Data Inicial</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">Data Final</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="slots">Número de Vagas</Label>
                    <Input
                      id="slots"
                      type="number"
                      value={slots}
                      onChange={(e) => setSlots(e.target.value)}
                      required
                      min="1"
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dailyRate">Valor da Diária</Label>
                    <Input
                      id="dailyRate"
                      type="number"
                      value={dailyRate}
                      onChange={(e) => setDailyRate(e.target.value)}
                      placeholder="Opcional"
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="flex items-center">
                  <Label htmlFor="halfLastDay" className="mr-2 text-sm">
                    Último dia meia diária
                  </Label>
                  <Switch
                    id="halfLastDay"
                    checked={halfLastDay}
                    onCheckedChange={setHalfLastDay}
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-4">
                <Button type="submit" className="w-full md:w-auto">
                  {editingTravel ? "Salvar Alterações" : "Criar Viagem"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingTravel(null);
                    setStartDate("");
                    setEndDate("");
                    setSlots("");
                    setDestination("");
                    setDailyAllowance("");
                    setDailyRate("");
                    setHalfLastDay(false);
                  }}
                  className="w-full md:w-auto"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {isAdmin && (
        <Button
          onClick={() => setIsModalOpen(true)}
          className="fixed bottom-4 right-4 rounded-full p-4 bg-[#3B82F6] hover:bg-[#2563eb] text-white shadow-lg"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
};

export default TravelManagement;
