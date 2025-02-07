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
  getDocs, 
  doc, 
  getDoc,
  updateDoc,
  deleteDoc 
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
import { MoreHorizontal, Edit, Trash2, Archive, Plus } from "lucide-react";

export const TravelManagement = () => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [slots, setSlots] = useState("");
  const [destination, setDestination] = useState("");
  // dailyAllowance passará a representar o total calculado (diárias) com base na data e no valor da diária
  const [dailyAllowance, setDailyAllowance] = useState("");
  // Novo campo para o valor da diária (custo por dia)
  const [dailyRate, setDailyRate] = useState("");
  // Toggle para considerar o último dia como meia diária
  const [halfLastDay, setHalfLastDay] = useState(false);
  const [isEditingAllowance, setIsEditingAllowance] = useState(false);
  const [travels, setTravels] = useState<any[]>([]);
  const [volunteerCounts, setVolunteerCounts] = useState<{ [key: string]: number }>({});
  const [editingTravel, setEditingTravel] = useState<any>(null);
  const [expandedTravels, setExpandedTravels] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    const fetchVolunteerCounts = async () => {
      try {
        const travelsRef = collection(db, "travels");
        const travelsSnapshot = await getDocs(travelsRef);
        const counts: { [key: string]: number } = {};

        travelsSnapshot.docs.forEach((doc) => {
          const travel = doc.data();
          if (travel.volunteers) {
            travel.volunteers.forEach((volunteer: string) => {
              counts[volunteer] = (counts[volunteer] || 0) + 1;
            });
          }
        });

        setVolunteerCounts(counts);
      } catch (error) {
        console.error("Erro ao buscar contagem de voluntários:", error);
      }
    };

    fetchVolunteerCounts();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "travels"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const travelsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTravels(travelsData);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Calcula o total das diárias com base na data, valor da diária e se o último dia vale meia
    if (startDate && endDate && dailyRate) {
      const start = new Date(startDate + "T00:00:00");
      const end = new Date(endDate + "T00:00:00");
      const numDays = differenceInDays(end, start) + 1;
      let total = numDays * Number(dailyRate);
      if (halfLastDay && numDays > 0) {
        total = total - Number(dailyRate) / 2;
      }
      setDailyAllowance(String(total));
    } else {
      setDailyAllowance("");
    }
  }, [startDate, endDate, dailyRate, halfLastDay]);

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
          dailyAllowance: Number(dailyAllowance),
          dailyRate: Number(dailyRate),
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
          dailyAllowance: Number(dailyAllowance),
          dailyRate: Number(dailyRate),
          halfLastDay,
          createdAt: new Date(),
          volunteers: [],
          archived: false,
        });

        toast({
          title: "Sucesso",
          description: "Viagem criada com sucesso!",
        });
      }

      // Limpa os campos e fecha o modal
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

  const handleEditTravel = (travel: any) => {
    setEditingTravel(travel);
    setStartDate(travel.startDate);
    setEndDate(travel.endDate);
    setSlots(String(travel.slots));
    setDestination(travel.destination);
    setDailyAllowance(String(travel.dailyAllowance));
    setDailyRate(String(travel.dailyRate));
    setHalfLastDay(travel.halfLastDay || false);
    setIsModalOpen(true);
  };

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

  const handleVolunteer = async (travelId: string) => {
    try {
      const travelRef = doc(db, "travels", travelId);
      const travelSnap = await getDoc(travelRef);

      if (!travelSnap.exists()) {
        throw new Error("Viagem não encontrada");
      }

      const travelData = travelSnap.data();
      const totalSlots = Number(travelData.slots);
      const currentVolunteers: string[] = Array.isArray(travelData.volunteers)
        ? travelData.volunteers
        : [];

      if (currentVolunteers.includes(user.name)) {
        toast({
          title: "Aviso",
          description: "Você já é voluntário desta viagem.",
        });
        return;
      }

      if (currentVolunteers.length >= totalSlots) {
        toast({
          title: "Aviso",
          description: "Não há mais vagas disponíveis.",
        });
        return;
      }

      const updatedVolunteers = [...currentVolunteers, user.name];
      await updateDoc(travelRef, {
        volunteers: updatedVolunteers,
      });

      setVolunteerCounts((prev) => ({
        ...prev,
        [user.name]: (prev[user.name] || 0) + 1,
      }));

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

  const handleUpdateDailyAllowance = async (travelId: string, newAllowance: string) => {
    try {
      const travelRef = doc(db, "travels", travelId);
      await updateDoc(travelRef, {
        dailyAllowance: Number(newAllowance),
      });
      setIsEditingAllowance(false);
      toast({
        title: "Sucesso",
        description: "Diárias atualizadas com sucesso!",
      });
    } catch (error) {
      console.error("Error updating daily allowance:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar diárias.",
        variant: "destructive",
      });
    }
  };

  const sortVolunteers = (volunteers: string[]) => {
    return [...volunteers].sort((a, b) => {
      const countA = volunteerCounts[a] || 0;
      const countB = volunteerCounts[b] || 0;
      return countA - countB;
    });
  };

  const toggleExpansion = (travelId: string) => {
    setExpandedTravels((prev) =>
      prev.includes(travelId)
        ? prev.filter((id) => id !== travelId)
        : [...prev, travelId]
    );
  };

  const formattedTravelCount = (count: number) => {
    return count === 1 ? "1 viagem" : `${count} viagens`;
  };

  return (
    <div className="p-6 space-y-8 relative">
      {/* Lista de viagens */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {travels
          .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
          .map((travel) => {
            const isArchived = travel.archived;
            const isExpanded = expandedTravels.includes(travel.id);
            const travelDate = new Date(travel.startDate + "T00:00:00");
            const today = new Date();
            const showVolunteerButton = travelDate > today && !isArchived;
            const sortedVolunteers = travel.volunteers ? sortVolunteers(travel.volunteers) : [];

            const minimalContent = (
              <div className="cursor-pointer" onClick={() => toggleExpansion(travel.id)}>
                <h3 className="text-xl font-semibold">{travel.destination}</h3>
                <p>Data Inicial: {new Date(travel.startDate + "T00:00:00").toLocaleDateString()}</p>
                <p>
                  Diárias: {travel.dailyAllowance} (Valor da diária: {travel.dailyRate})
                </p>
              </div>
            );

            const fullContent = (
              <div>
                <div className="mb-2 cursor-pointer" onClick={() => toggleExpansion(travel.id)}>
                  <h3 className="text-xl font-semibold text-primary">{travel.destination}</h3>
                </div>
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  <p>Data Inicial: {new Date(travel.startDate + "T00:00:00").toLocaleDateString()}</p>
                  <p>Data Final: {new Date(travel.endDate + "T00:00:00").toLocaleDateString()}</p>
                  <p>Vagas: {travel.slots}</p>
                  <p>
                    Diárias: {travel.dailyAllowance} (Valor da diária: {travel.dailyRate})
                  </p>
                  {travel.volunteers && travel.volunteers.length > 0 && (
                    <div className="pt-4 border-t border-gray-100">
                      <h4 className="font-medium text-sm text-gray-700 mb-2">
                        Voluntários (ordenados por menor número de viagens):
                      </h4>
                      <ul className="space-y-1">
                        {sortedVolunteers.map((volunteerName: string) => (
                          <li
                            key={volunteerName}
                            className="text-sm text-gray-600 bg-gray-50 p-2 rounded flex justify-between items-center"
                          >
                            <span>{volunteerName}</span>
                            <span className="text-xs text-gray-500">
                              {formattedTravelCount(volunteerCounts[volunteerName] || 0)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {showVolunteerButton && (
                  <div className="mt-4">
                    <Button
                      onClick={() => handleVolunteer(travel.id)}
                      className="w-full bg-[#3B82F6] hover:bg-[#2563eb] text-white"
                      disabled={travel.volunteers?.includes(user.name)}
                    >
                      {travel.volunteers?.includes(user.name)
                        ? "Já Inscrito"
                        : "Quero ser Voluntário"}
                    </Button>
                  </div>
                )}
              </div>
            );

            return (
              <Card
                key={travel.id}
                onClick={isArchived ? () => toggleExpansion(travel.id) : undefined}
                className={`p-6 hover:shadow-xl transition-shadow relative ${
                  isArchived ? "bg-gray-200 cursor-pointer" : "bg-white"
                }`}
              >
                {user.userType === "admin" && (
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <div className="space-y-4">
                  {isArchived && !isExpanded ? minimalContent : fullContent}
                </div>
              </Card>
            );
          })}
      </div>

      {/* Modal para criar/editar viagem */}
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
              className="absolute top-2 right-2 text-gray-600 hover:text-gray-800"
            >
              X
            </button>
            <form onSubmit={handleCreateTravel} className="space-y-6">
              <h2 className="text-2xl font-semibold text-primary">
                {editingTravel ? "Editar Viagem" : "Criar Nova Viagem"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="destination">Destino</Label>
                  <Input
                    id="destination"
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    required
                    className="w-full"
                    placeholder="Digite o destino"
                  />
                </div>
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
                <div className="space-y-2">
                  <Label htmlFor="slots">Número de Vagas</Label>
                  <Input
                    id="slots"
                    type="number"
                    value={slots}
                    onChange={(e) => setSlots(e.target.value)}
                    required
                    className="w-full"
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dailyRate">Valor da Diária</Label>
                  <Input
                    id="dailyRate"
                    type="number"
                    value={dailyRate}
                    onChange={(e) => setDailyRate(e.target.value)}
                    required
                    className="w-full"
                    placeholder="Digite o valor da diária"
                  />
                </div>
                <div className="col-span-1 flex items-center space-x-2">
                  <Label htmlFor="halfLastDay" className="text-sm">
                    Último dia meia diária
                  </Label>
                  <input
                    id="halfLastDay"
                    type="checkbox"
                    checked={halfLastDay}
                    onChange={(e) => setHalfLastDay(e.target.checked)}
                  />
                </div>
              </div>
              <div className="flex gap-4">
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

      {/* Botão flutuante para administradores */}
      {user.userType === "admin" && (
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
