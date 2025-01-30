import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db, limitOperations } from "@/lib/firebase";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface UserLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface User {
  id: string;
  warName: string;
  rank?: string;
}

const UserLimitDialog = ({ open, onOpenChange }: UserLimitDialogProps) => {
  const [limitType, setLimitType] = useState<"all" | "individual">("all");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [limit, setLimit] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const usersData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as User[];
        setUsers(usersData);
      } catch (error) {
        console.error("Error fetching users:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível carregar a lista de usuários."
        });
      }
    };

    if (open && limitType === "individual") {
      fetchUsers();
    }
  }, [open, limitType, toast]);

  const handleSubmit = async () => {
    if (!limit || isNaN(Number(limit)) || Number(limit) < 1) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Por favor, insira um número válido maior que zero."
      });
      return;
    }

    if (limitType === "individual" && !selectedUser) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Por favor, selecione um usuário."
      });
      return;
    }

    try {
      const limitValue = Number(limit);
      let result;
      
      if (limitType === "all") {
        result = await limitOperations.setGlobalLimit(limitValue);
      } else {
        result = await limitOperations.setUserLimit(selectedUser, limitValue);
      }

      if (!result.success) {
        throw new Error('Failed to set limit');
      }

      toast({
        title: "Sucesso",
        description: `Limite ${limitType === "all" ? "global" : "individual"} definido com sucesso.`
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error setting limit:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível definir o limite."
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Definir Limite de Vagas</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <RadioGroup
            value={limitType}
            onValueChange={(value: "all" | "individual") => {
              setLimitType(value);
              setSelectedUser("");
              setLimit("");
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all">Todos</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="individual" id="individual" />
                <Label htmlFor="individual">Individual</Label>
              </div>
            </div>
          </RadioGroup>

          {limitType === "individual" && (
            <ScrollArea className="h-[200px] rounded-md border p-4">
              <RadioGroup value={selectedUser} onValueChange={setSelectedUser}>
                {users.map((user) => (
                  <div key={user.id} className="flex items-center space-x-2 mb-2">
                    <RadioGroupItem value={user.id} id={user.id} />
                    <Label htmlFor={user.id}>
                      {user.rank ? `${user.rank} ${user.warName}` : user.warName}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </ScrollArea>
          )}

          <div className="space-y-2">
            <Label htmlFor="limit">Limite de Vagas</Label>
            <Input
              id="limit"
              type="number"
              min="1"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="Digite o número de vagas"
            />
          </div>

          <Button onClick={handleSubmit} className="w-full">
            Definir Limite
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserLimitDialog;